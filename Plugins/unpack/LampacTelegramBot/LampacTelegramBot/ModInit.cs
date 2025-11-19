using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using System.Text.Json.Nodes;
using Shared.Models.Module;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;
using Telegram.Bot.Polling;

namespace TelegramBot
{
    public class ModInit
    {
        private static ITelegramBotClient _bot;
        private static readonly string userFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "users.json");
        private static string stateFilePath; // Изменено на нестатическое поле, чтобы использовать conf.path
        private static CancellationTokenSource _cts;
        private static long adminId = 0;

        public static void loaded(InitspaceModel conf)
        {
            stateFilePath = Path.Combine(conf.path, "stateFile.json"); // Инициализация пути с использованием conf.path
            ThreadPool.QueueUserWorkItem(async _ =>
            {
                try
                {
                    var manifestPath = Path.Combine(conf.path, "manifest.json");
                    var manifestJson = File.ReadAllText(manifestPath);
                    var p = JsonNode.Parse(manifestJson)["params"];
                    string bottoken = p["bottoken"].GetValue<string>();
                    adminId = long.Parse(p["adminid"].ToString());
                    _cts = new CancellationTokenSource();
                    _bot = new TelegramBotClient(bottoken, cancellationToken: _cts.Token);
                    _bot.StartReceiving(
                        new DefaultUpdateHandler(UpdateHandler, ErrorHandler),
                        new ReceiverOptions
                        {
                            AllowedUpdates = new[] { UpdateType.Message, UpdateType.CallbackQuery }
                        },
                        _cts.Token
                    );
                    var me = await _bot.GetMeAsync();
                    Console.WriteLine($"\t@{me.Username} is running...");
                    await Task.Delay(-1, _cts.Token);
                }
                catch (Exception ex) { Console.WriteLine("TelegramBot Exception: " + ex); }
            });
        }

        private static async Task UpdateHandler(ITelegramBotClient bot, Update update, CancellationToken cancellationToken)
        {
            long chatId = update.Type switch
            {
                UpdateType.Message => update.Message.Chat.Id,
                UpdateType.CallbackQuery => update.CallbackQuery.Message.Chat.Id,
                _ => 0
            };
            if (chatId != adminId)
            {
                if (update.Type == UpdateType.Message)
                {
                    await bot.SendTextMessageAsync(
                        chatId: chatId,
                        text: "⛔ Доступ запрещен. Этот бот только для администратора.",
                        cancellationToken: cancellationToken
                    );
                }
                return;
            }
            if (update.Type == UpdateType.Message && update.Message.Type == MessageType.Text)
            {
                await HandleAdminMessage(bot, update.Message, cancellationToken);
            }
            else if (update.Type == UpdateType.CallbackQuery)
            {
                await CallbackQueryHandler(bot, update.CallbackQuery, cancellationToken);
            }
        }

        private static async Task HandleAdminMessage(ITelegramBotClient bot, Message message, CancellationToken cancellationToken)
        {
            var chatId = message.Chat.Id;
            string response = "";
            var users = LoadUsers();
            var states = LoadState() ?? new List<StateInfo>();
            var stateinfo = states.FirstOrDefault(s => s.chatId == chatId) ?? new StateInfo { chatId = chatId, state = "start" };

            switch (stateinfo.state)
            {
                case "start":
                    response = await HandleAdminCommands(bot, message, stateinfo, users, cancellationToken);
                    break;
                case "newUser_id":
                    response = await HandleNewUserIdState(bot, message, stateinfo, users, cancellationToken);
                    break;
                case "newUser_group":
                    response = await HandleNewUserGroupState(bot, message, stateinfo, users, cancellationToken);
                    break;
                case "newUser_expires":
                    response = await HandleNewUserExpiresState(bot, message, stateinfo, users, cancellationToken);
                    break;
                case "newUser_comment":
                    response = HandleNewUserCommentState(message, stateinfo, users);
                    break;
            }

            var replyMarkup = GetAdminReplyMarkup(stateinfo.state);
            if (response != null)
            {
                await bot.SendTextMessageAsync(
                    chatId,
                    response,
                    replyMarkup: replyMarkup,
                    parseMode: ParseMode.Html,
                    cancellationToken: cancellationToken
                );
            }
            if (!states.Contains(stateinfo)) states.Add(stateinfo);
            SaveState(states);
        }

        private static async Task<string> HandleAdminCommands(ITelegramBotClient bot, Message message, StateInfo stateinfo, List<User> users, CancellationToken cancellationToken)
        {
            string response = "";
            switch (message.Text.ToLower())
            {
                case "/start":
                    response = "👋 <b>Привет, админ!</b> Выберите действие:";
                    break;
                case "🆕 новый пользователь":
                    stateinfo.state = "newUser_id";
                    response = "📝 <b>Введите ID нового пользователя:</b>\n• Не менее 6 символов\n• Только латинские буквы, цифры и @ _ ! .\n• Пример: <code>user123@name</code>";
                    break;
                case "🗑 удалить пользователя":
                    response = await HandleDeleteUser(bot, message.Chat.Id, users, cancellationToken);
                    break;
                case "👥 пользователи":
                    response = await HandleListUsers(bot, message.Chat.Id, users, cancellationToken);
                    break;
                case "⚙️ изменить параметры":
                    response = await HandleChangeUserParams(bot, message.Chat.Id, users, cancellationToken);
                    break;
                case "📅 продлить доступ":
                    response = await HandleExtendService(bot, message.Chat.Id, users, cancellationToken);
                    break;
                default:
                    response = "❌ <b>Неизвестная команда.</b> Используйте кнопки меню.";
                    break;
            }
            return response;
        }

        private static async Task<string> HandleNewUserIdState(ITelegramBotClient bot, Message message, StateInfo stateinfo, List<User> users, CancellationToken cancellationToken)
        {
            if (message.Text == "❌ Отменить добавление")
            {
                stateinfo.state = "start";
                return "🚫 <b>Добавление пользователя отменено.</b>";
            }
            string userId = message.Text.ToLower();
            if (userId.Length < 6)
            {
                return "⚠️ <b>ID должен быть не короче 6 символов.</b> Введите другой ID:";
            }
            if (!Regex.IsMatch(userId, @"^[a-z0-9@_\!\.]+$"))
            {
                return "⚠️ <b>Некорректный ID.</b> Используйте только латинские буквы, цифры и символы @, _, !, .";
            }
            if (users.Any(u => u.id == userId))
            {
                return "⚠️ <b>Этот ID уже существует.</b> Введите другой ID:";
            }
            stateinfo.tempUser = new User { id = userId };
            stateinfo.state = "newUser_group";
            return "🔢 <b>Введите группу пользователя:</b>\n• Число от 0 до 10\n• Или нажмите '1️⃣ Группа 1'";
        }

        private static async Task<string> HandleNewUserGroupState(ITelegramBotClient bot, Message message, StateInfo stateinfo, List<User> users, CancellationToken cancellationToken)
        {
            if (message.Text == "❌ Отменить добавление")
            {
                stateinfo.state = "start";
                return "🚫 <b>Добавление пользователя отменено.</b>";
            }
            int group;
            if (message.Text == "1️⃣ Группа 1")
            {
                group = 1;
            }
            else
            {
                if (!int.TryParse(message.Text, out group) || group < 0 || group > 10)
                {
                    return "⚠️ <b>Некорректная группа.</b> Введите число от 0 до 10 или выберите '2️⃣ Группа 2'";
                }
            }
            stateinfo.tempUser.group = group;
            stateinfo.state = "newUser_expires";
            return "📅 <b>Введите дату окончания доступа:</b>\n• Формат: <code>ДД.ММ.ГГГГ</code>\n• Или нажмите '📆 6 месяцев'";
        }

        private static async Task<string> HandleNewUserExpiresState(ITelegramBotClient bot, Message message, StateInfo stateinfo, List<User> users, CancellationToken cancellationToken)
        {
            if (message.Text == "❌ Отменить добавление")
            {
                stateinfo.state = "start";
                return "🚫 <b>Добавление пользователя отменено.</b>";
            }
            DateTime expiresDate;
            if (message.Text == "📆 6 месяцев")
            {
                expiresDate = DateTime.Now.AddMonths(6);
            }
            else
            {
                if (!DateTime.TryParseExact(message.Text, "dd.MM.yyyy", null, System.Globalization.DateTimeStyles.None, out expiresDate))
                {
                    return "⚠️ <b>Некорректный формат даты.</b> Введите в формате <code>ДД.ММ.ГГГГ</code> или выберите '📆 6 месяцев'";
                }
            }
            stateinfo.tempUser.expires = expiresDate.ToString("yyyy-MM-ddTHH:mm:sszzz");
            stateinfo.state = "newUser_comment";
            return "💬 <b>Добавьте комментарий:</b>\n• Любой текст\n• Или нажмите '💬 Без комментария'";
        }

        private static string HandleNewUserCommentState(Message message, StateInfo stateinfo, List<User> users)
        {
            if (message.Text == "❌ Отменить добавление")
            {
                stateinfo.state = "start";
                return "🚫 <b>Добавление пользователя отменено.</b>";
            }
            stateinfo.tempUser.comment = message.Text == "💬 Без комментария" ? null : message.Text;
            stateinfo.tempUser.Params = new Params { adult = false, admin = false }; // 🔧 Добавлено
            users.Add(stateinfo.tempUser);
            SaveUsers(users);
            var newUser = stateinfo.tempUser;
            stateinfo.tempUser = null;
            stateinfo.state = "start";
            return "✅ <b>Пользователь успешно добавлен!</b>\n" +
                   "🆔 <b>ID:</b> <code>" + EscapeHtml(newUser.id) + "</code>\n" +
                   "🏷 <b>Группа:</b> <code>" + newUser.group + "</code>\n" +
                   "📅 <b>Доступ до:</b> <code>" + EscapeHtml(DateTime.Parse(newUser.expires).ToString("dd.MM.yyyy")) + "</code>\n" +
                   "💬 <b>Комментарий:</b> <i>" + EscapeHtml(newUser.comment ?? "") + "</i>";
        }

        private static string EscapeHtml(string text)
        {
            if (string.IsNullOrEmpty(text))
                return text;
            return text.Replace("&", "&amp;").Replace("<", "<").Replace(">", ">");
        }

        private static ReplyMarkup GetAdminReplyMarkup(string state)
        {
            switch (state)
            {
                case "start":
                    return new ReplyKeyboardMarkup(new[]
                    {
                        new KeyboardButton[] { "🆕 Новый пользователь", "👥 Пользователи" },
                        new KeyboardButton[] { "🗑 Удалить пользователя", "⚙️ Изменить параметры" },
                        new KeyboardButton[] { "📅 Продлить доступ" }
                    }) { ResizeKeyboard = true };
                case "newUser_id":
                    return new ReplyKeyboardMarkup(new[] { new KeyboardButton[] { "❌ Отменить добавление" } }) { ResizeKeyboard = true };
                case "newUser_group":
                    return new ReplyKeyboardMarkup(new[] {
                        new KeyboardButton[] { "1️⃣ Группа 1" },
                        new KeyboardButton[] { "❌ Отменить добавление" }
                    }) { ResizeKeyboard = true };
                case "newUser_expires":
                    return new ReplyKeyboardMarkup(new[] {
                        new KeyboardButton[] { "📆 6 месяцев" },
                        new KeyboardButton[] { "❌ Отменить добавление" }
                    }) { ResizeKeyboard = true };
                case "newUser_comment":
                    return new ReplyKeyboardMarkup(new[] {
                        new KeyboardButton[] { "💬 Без комментария" },
                        new KeyboardButton[] { "❌ Отменить добавление" }
                    }) { ResizeKeyboard = true };
                default:
                    return new ReplyKeyboardRemove();
            }
        }

        private static async Task<string> HandleDeleteUser(ITelegramBotClient bot, long chatId, List<User> users, CancellationToken cancellationToken)
        {
            if (users.Count == 0) return "<tool_call> Список пользователей пуст.";
            foreach (var user in users)
            {
                var inlineKeyboard = new InlineKeyboardMarkup(new[]
                {
                    new[] { InlineKeyboardButton.WithCallbackData("🗑 Удалить", $"delete:{user.id}") }
                });
                await bot.SendTextMessageAsync(
                    chatId,
                    $"👤 <b>Пользователь:</b> <code>{EscapeHtml(user.id)}</code>",
                    replyMarkup: inlineKeyboard,
                    parseMode: ParseMode.Html,
                    cancellationToken: cancellationToken
                );
            }
            return null;
        }

        private static async Task<string> HandleListUsers(ITelegramBotClient bot, long chatId, List<User> users, CancellationToken cancellationToken)
        {
            if (users.Count == 0) return "<tool_call> Список пользователей пуст.";
            foreach (var user in users)
            {
                var expiresDate = DateTime.Parse(user.expires).ToString("dd.MM.yyyy");
                var inlineKeyboard = new InlineKeyboardMarkup(new[]
                {
                    new[] { InlineKeyboardButton.WithCallbackData("ℹ️ Подробнее", $"info:{user.id}") }
                });
                await bot.SendTextMessageAsync(
                    chatId,
                    $"👤 <b>{EscapeHtml(user.id)}</b>\n" +
                    $"🏷 <b>Группа:</b> <code>{user.group}</code>\n" +
                    $"📅 <b>Доступ до:</b> <code>{EscapeHtml(expiresDate)}</code>\n" +
                    $"💬 <b>Комментарий:</b> <i>{EscapeHtml(user.comment ?? "")}</i>",
                    replyMarkup: inlineKeyboard,
                    parseMode: ParseMode.Html,
                    cancellationToken: cancellationToken
                );
            }
            return null;
        }

        private static async Task<string> HandleChangeUserParams(ITelegramBotClient bot, long chatId, List<User> users, CancellationToken cancellationToken)
        {
            if (users.Count == 0) return "<tool_call> Нет пользователей.";
            foreach (var user in users)
            {
                var inlineKeyboard = new InlineKeyboardMarkup(new[]
                {
                    new[] { InlineKeyboardButton.WithCallbackData("⚙️ Настроить", $"editparams:{user.id}") }
                });
                await bot.SendTextMessageAsync(
                    chatId,
                    $"👤 <b>{EscapeHtml(user.id)}</b>\n" +
                    $"🏷 <b>Группа:</b> <code>{user.group}</code>",
                    replyMarkup: inlineKeyboard,
                    parseMode: ParseMode.Html,
                    cancellationToken: cancellationToken
                );
            }
            return null;
        }

        private static async Task<string> HandleExtendService(ITelegramBotClient bot, long chatId, List<User> users, CancellationToken cancellationToken)
        {
            if (users.Count == 0) return "<tool_call> Нет пользователей.";
            foreach (var user in users)
            {
                var expiresDate = DateTime.Parse(user.expires).ToString("dd.MM.yyyy");
                var inlineKeyboard = new InlineKeyboardMarkup(new[]
                {
                    new[] { InlineKeyboardButton.WithCallbackData("➕ 1 месяц", $"extendservice:{user.id}") }
                });
                await bot.SendTextMessageAsync(
                    chatId,
                    $"👤 <b>{EscapeHtml(user.id)}</b>\n" +
                    $"🏷 <b>Группа:</b> <code>{user.group}</code>\n" +
                    $"📅 <b>Текущий доступ до:</b> <code>{EscapeHtml(expiresDate)}</code>",
                    replyMarkup: inlineKeyboard,
                    parseMode: ParseMode.Html,
                    cancellationToken: cancellationToken
                );
            }
            return null;
        }

        private static async Task CallbackQueryHandler(ITelegramBotClient bot, CallbackQuery callbackQuery, CancellationToken cancellationToken)
        {
            var chatId = callbackQuery.Message.Chat.Id;
            var data = callbackQuery.Data.Split(':');
            if (data.Length < 2) return;
            var action = data[0];
            var userId = data[1].ToLower();
            var users = LoadUsers();
            var user = users.FirstOrDefault(u => u.id == userId);

            switch (action)
            {
                case "delete":
                    if (user != null)
                    {
                        users.Remove(user);
                        SaveUsers(users);
                        await bot.EditMessageTextAsync(
                            chatId,
                            callbackQuery.Message.MessageId,
                            $"❌ Пользователь <code>{EscapeHtml(userId)}</code> удален.",
                            parseMode: ParseMode.Html,
                            cancellationToken: cancellationToken
                        );
                    }
                    break;

                case "info":
                    if (user != null)
                    {
                        var expiresDate = DateTime.Parse(user.expires).ToString("dd.MM.yyyy");
                        var message = $"👤 <b>{EscapeHtml(user.id)}</b>\n" +
                                      $"📋 <b>Основное:</b>\n" +
                                      $"  🏷 <b>Группа:</b> <code>{user.group}</code>\n" +
                                      $"  📅 <b>Доступ до:</b> <code>{EscapeHtml(expiresDate)}</code>\n" +
                                      $"  💬 <b>Комментарий:</b> <i>{EscapeHtml(user.comment ?? "")}</i>\n" +
                                      $"⚙️ <b>Параметры:</b>\n" +
                                      $"  🔞 <b>Adult:</b> {(user.Params.adult ? "✅" : "❌")}\n" +
                                      $"  🧑‍💼 <b>Admin:</b> {(user.Params.admin ? "✅" : "❌")}"; // 🔧 Добавлено
                        await bot.SendTextMessageAsync(chatId, message, parseMode: ParseMode.Html, cancellationToken: cancellationToken);
                    }
                    else
                    {
                        await bot.SendTextMessageAsync(chatId, "⚠️ Пользователь не найден", cancellationToken: cancellationToken);
                    }
                    break;

                case "extendservice":
                    if (user != null)
                    {
                        user.expires = DateTime.Parse(user.expires).AddMonths(1).ToString("yyyy-MM-ddTHH:mm:sszzz");
                        SaveUsers(users);
                        await bot.SendTextMessageAsync(chatId,
                            $"✅ Доступ для <code>{EscapeHtml(user.id)}</code> продлен до {DateTime.Parse(user.expires).ToString("dd.MM.yyyy")}",
                            parseMode: ParseMode.Html, cancellationToken: cancellationToken);
                    }
                    break;

                case "editparams":
                    if (user != null)
                    {
                        var inlineKeyboard = new InlineKeyboardMarkup(new[]
                        {
                            new[] { InlineKeyboardButton.WithCallbackData($"🔞 Adult: {(user.Params.adult ? "✅" : "❌")}", $"toggle:{user.id}:adult") },
                            new[] { InlineKeyboardButton.WithCallbackData($"🧑‍💼 Admin: {(user.Params.admin ? "✅" : "❌")}", $"toggle:{user.id}:admin") }
                        });

                        await bot.SendTextMessageAsync(
                            chatId,
                            $"⚙️ Настройки для <code>{EscapeHtml(user.id)}</code>:",
                            replyMarkup: inlineKeyboard,
                            parseMode: ParseMode.Html,
                            cancellationToken: cancellationToken
                        );
                    }
                    break;

                case "toggle":
                    if (user != null && data.Length == 3)
                    {
                        var param = data[2];
                        if (param == "adult") user.Params.adult = !user.Params.adult;
                        if (param == "admin") user.Params.admin = !user.Params.admin;

                        SaveUsers(users);
                        var newKeyboard = new InlineKeyboardMarkup(new[]
                        {
                            new[] { InlineKeyboardButton.WithCallbackData($"🔞 Adult: {(user.Params.adult ? "✅" : "❌")}", $"toggle:{user.id}:adult") },
                            new[] { InlineKeyboardButton.WithCallbackData($"🧑‍💼 Admin: {(user.Params.admin ? "✅" : "❌")}", $"toggle:{user.id}:admin") }
                        });

                        await bot.EditMessageReplyMarkupAsync(
                            chatId,
                            callbackQuery.Message.MessageId,
                            replyMarkup: newKeyboard,
                            cancellationToken: cancellationToken
                        );
                    }
                    break;
            }
        }

        private static List<User> LoadUsers()
        {
            try
            {
                if (File.Exists(userFilePath))
                {
                    return JsonConvert.DeserializeObject<List<User>>(File.ReadAllText(userFilePath)) ?? new List<User>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("⚠️ LoadUsers Error: " + ex.Message);
            }
            return new List<User>();
        }

        private static void SaveUsers(List<User> users)
        {
            try
            {
                File.WriteAllText(userFilePath, JsonConvert.SerializeObject(users, Formatting.Indented));
            }
            catch (Exception ex)
            {
                Console.WriteLine("⚠️ SaveUsers Error: " + ex.Message);
            }
        }

        private static void SaveState(List<StateInfo> states)
        {
            try
            {
                File.WriteAllText(stateFilePath, JsonConvert.SerializeObject(states, Formatting.Indented));
            }
            catch (Exception ex)
            {
                Console.WriteLine("⚠️ SaveState Error: " + ex.Message);
            }
        }

        private static List<StateInfo> LoadState()
        {
            try
            {
                if (File.Exists(stateFilePath))
                {
                    return JsonConvert.DeserializeObject<List<StateInfo>>(File.ReadAllText(stateFilePath)) ?? new List<StateInfo>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("⚠️ LoadState Error: " + ex.Message);
            }
            return new List<StateInfo>();
        }

        private static Task ErrorHandler(ITelegramBotClient botClient, Exception exception, CancellationToken cancellationToken)
        {
            var errorMessage = exception switch
            {
                ApiRequestException apiEx => $"⚠️ Telegram API Error: [{apiEx.ErrorCode}] {apiEx.Message}",
                _ => exception.ToString()
            };
            Console.WriteLine(errorMessage);
            return Task.CompletedTask;
        }
    }

    public class User
    {
        public string id { get; set; }
        public int? group { get; set; }
        public string expires { get; set; }
        public string comment { get; set; }
        [JsonProperty("params")]
        public Params Params { get; set; } = new Params();
    }

    public class Params
    {
        public bool adult { get; set; }
        public bool admin { get; set; } // 🔧 Добавлено
    }

    public class StateInfo
    {
        public long chatId { get; set; }
        public string state { get; set; }
        public User tempUser { get; set; }
    }
}