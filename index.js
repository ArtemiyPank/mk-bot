const dotenv = require("dotenv")
const {Telegraf} = require("telegraf")
const {generateUsername} = require("unique-username-generator")
const BigDecimal = require("js-big-decimal")
const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./mk-bot_db/mk-bot_db.sqlite')

dotenv.config()
const bot = new Telegraf(process.env.BOT_TOKEN)

const rules = `
1 = 0.1
5 = 0.5
25 = 1
50 = 2
10 = 5

*При выводе, кружок забирает 15%*

Посмотреть, сколько насчитали: /balance
Сменить username: \`/rename НОВЫЙ_ЮЗЕРНЕЙМ\`

*Успехов в математике!*
`

function countCashOut(chips) {
  const percent = 0.15
  let tax
  if (chips < (0.1 / percent)) {
    tax = 0.1
  } else {
    tax = Number((chips * percent).toFixed(1))
  }
  const money = Number(BigDecimal.subtract(chips, tax))
  return {money, tax}
}

async function getUsers(parameters = []) {
  let sql = `SELECT * FROM users     `
  if (parameters.length !== 0) {
    const placeholders = parameters[1].map(() => '?').join(',')
    sql += `WHERE ${parameters[0]} IN (${placeholders})`
  }

  return new Promise((resolve, reject) => {
    db.all(sql, parameters[1], (err, rows) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows)
      }
    })
  })
}


bot.on("text", async (request) => {
  try {
    if (request.message) {
      let {
        chat: {
          id: sendersID, username: sendersUsername
        }, text
      } = request.message

      const command = text.split(' ')[0]
      let args = []
      if (text.split(' ').length > 1) {
        args = text.split(' ').slice(1)
      }


      /*
      Access levels:
      0 - regular user
      1 - user can check balance of other users(Commands: /balance <username>)
      2 - user can check list of balances of other users(Commands: /users)
      3 - user can rename other users(Command: /rename <username> <new username>)
      4 - user can perform operations on the balance of other users(Command: /deposit <username> <value> /cashOut <username> <value>)
      5 - in the development - user can give salary to shareholder(Command: /salary)
      8 - full access
      */

      const admins = [['865114970', 8, 'Artemiy', 30], ['705440585', 4, 'Nikita', 15], ['708382963', 4, 'Yriy', 15], ['930912808', 3, 'Andrey', 15], ['1080883134', 2, 'Ilya', 5], // ['5739959347', 1, 'Test', 0]
      ]

      let accessLevel = 0
      for (const admin of admins) {
        if (admin[0] === sendersID.toString()) {
          accessLevel = admin[1]
        }
      }

      const sendersRecords = await getUsers(['id', [sendersID]])

      let sendersRecord
      if (sendersRecords.length !== 0) {
        sendersRecord = sendersRecords[0]
        sendersUsername = sendersRecord['username']
      }

      console.log(sendersID, accessLevel, sendersUsername, text)

      let messages = []
      let message

      switch (command) {
        case '/start':
          if (sendersRecords.length === 0) {

            // находим незанятый username
            let repeatedUsername = await getUsers(['username', [sendersUsername]])
            while (repeatedUsername.length !== 0 || sendersUsername === undefined) {
              sendersUsername = generateUsername("-", 0, 10)

              repeatedUsername = await getUsers(['username', [sendersUsername]])
            }

            message = `Ваш username: ${sendersUsername}\n\nДля смены ника пропишите \`/rename НОВЫЙ_ЮЗЕРНЕЙМ\``
            messages.push([sendersID, message])

            // Данные нового пользователя
            const newUser = {
              username: sendersUsername,
              balance: '0',
              id: sendersID,
            }

            // Вставляем нового пользователя в таблицу users
            const sql = `INSERT INTO users (id, username, balance) VALUES (?, ?, ?)`
            const values = [newUser.id, newUser.username, newUser.balance]
            db.run(sql, values, function (err) {
              if (err) {
                throw err
              }
              console.log(`New user with username ${sendersUsername} and ID ${this.lastID} added to table users`)
            })
          } else {
            message = `Ваш username: ${sendersUsername}\n` + rules
            messages.push([sendersID, message])
          }
          break

        case '/rename':
          if (sendersRecords.length === 1) {
            if (args.length >= 1 && args.length < 3) {

              // определяем кому менять username и на что
              let currentRecord
              let newUsername
              if (args.length === 2) {
                if (accessLevel >= 3) {
                  let currentRecords = await getUsers(['username', [args[0]]])

                  if (currentRecords.length !== 0) {
                    currentRecord = currentRecords[0]
                    newUsername = args[1]
                  } else {
                    message = `Пользователь ${args[0]} не найден`
                    messages.push([sendersID, message])
                    break
                  }
                } else {
                  messages.push([sendersID, "Access denied"])
                  break
                }
              } else {
                currentRecord = sendersRecord
                newUsername = args[0]
              }

              //проверка на совпадающие ники
              const withThisUsername = await getUsers(['username', [newUsername]])

              if (withThisUsername.length === 0) {

                // изменение записи в db
                db.run('UPDATE users SET username = ? WHERE id = ?', [newUsername, currentRecord['id']])

                message = `Ваш username был изменён на ${newUsername}`
                messages.push([currentRecord['id'], message])
                if (args.length === 2) {
                  message = `Username пользователя ${args[0]} был изменён на ${newUsername}`
                  messages.push([sendersID, message])
                }
              } else {
                message = `Увы, это имя уже занято.`
                messages.push([sendersID, message])
              }
            } else {
              message = `Вы неправильно воспользовались командой.\nНужно написать: \`/rename НОВЫЙ_ЮЗЕРНЕЙМ\``
              messages.push([sendersID, message])
            }
          } else {
            message = `Вы пока не зарегестрированы в системе, пропишите /start, чтобы это исправить`
            messages.push([sendersID, message])
          }
          break

        case '/balance':
          let currentUsername = (accessLevel >= 1 && args.length === 1) ? args[0] : sendersUsername

          let balances = await getUsers(['username', [currentUsername, 'profit']])
          if (balances.length !== 2) {
            if (currentUsername === sendersUsername) {
              message = `Вы пока не зарегестрированы в системе, пропишите /start, чтобы это исправить`
            } else {
              message = `Пользователь ${currentUsername} не найден`
            }
            messages.push([sendersID, message])
          } else {
            const profit = balances[0]['id'].toString() === '1' ? balances[0] : balances[1]
            const user = balances[0]['id'].toString() === sendersID.toString() ? balances[0] : balances[1]

            if (accessLevel === 0) {
              message = `Ваш баланс: ${user['balance']}`
            } else {
              message = `Баланс пользователя ${currentUsername}: ${user['balance']} \nПрофит кружка: ${profit['balance']}`

              //расчёт размера банка
              let totalBalance = '0'
              let records = await getUsers()

              records.forEach((record) => {
                totalBalance = BigDecimal.add(totalBalance, record['balance'])
              })
              message += '\nБаланс банка: ' + totalBalance
            }
            messages.push([sendersID, message])
          }
          break


        case '/users':
          if (accessLevel >= 2) {
            let usersList = ''
            const records = await getUsers([])

            //перебор всех записей в БД
            for (const record of records) {
              let currentUsername = record['username']
              if (currentUsername !== 'profit') {
                usersList += `\`${currentUsername}\`: ${record['balance']}\n`
              }
            }
            messages.push([sendersID, usersList])
          } else {
            messages.push([sendersID, "Access denied"])
          }
          break

        case '/deposit':
          if (accessLevel >= 4) {
            if (args.length === 2 && !isNaN(args[1])) {
              const currentUsername = args[0]
              const userRecords = await getUsers(['username', [currentUsername]])

              if (userRecords.length > 0) {
                const currentRecord = userRecords[0]
                const currentUserId = currentRecord['id']
                const currentUserBalance = currentRecord['balance']

                const balanceChanging = args[1]

                // подсчёт и запись нового баланса
                const newBalance = BigDecimal.add(currentUserBalance, balanceChanging)

                db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, currentUserId])

                //уведомление админа
                message = `Баланс пользователя \`${currentUsername}\` теперь равен ${newBalance}`
                messages.push([sendersID, message])

                //уведомление получателя
                if (currentUsername !== 'profit') {
                  const action = (Number(balanceChanging) < 0) ? 'уменьшился' : 'увеличился'
                  message = `Ваш баланс ${action} на ${Math.abs(Number(balanceChanging))}\nТеперь он равен ${newBalance}`
                  messages.push([currentUserId, message])
                }
              } else {
                message = `Пользователь ${currentUsername} не найден`
                messages.push([sendersID, message])
              }
            } else {
              message = `Вы неправильно воспользовались командой.\nНужно написать: \`/deposit USERNAME VALUE\``
              messages.push([sendersID, message])
            }
          } else {
            messages.push([sendersID, "Access denied"])
          }
          break

        case '/cashOut':
          if (accessLevel >= 4) {
            if (args.length === 2 && !isNaN(args[1])) {

              const records = await getUsers(['username', [args[0], 'profit']])

              if (records.length > 1) {
                if (records[0]['username'] === 'profit') {
                  [records[0], records[1]] = [records[1], records[0]]
                }

                const userRecord = records[0]
                const profitRecord = records[1]

                const {money, tax} = countCashOut(args[1])

                //обновление баланса пользователя
                const userBalance = userRecord['balance']
                const newUserBalance = BigDecimal.subtract(userBalance, args[1])
                db.run('UPDATE users SET balance = ? WHERE id = ?', [newUserBalance, userRecord['id']])

                //обновление профита
                const profitBalance = profitRecord['balance']
                const newProfitBalance = BigDecimal.add(profitBalance, tax)
                db.run('UPDATE users SET balance = ? WHERE id = ?', [newProfitBalance, profitRecord['id']])


                //сообщение админу
                message = `Нужно выдать: ${money} \nНынешний баланс пользователя ${userRecord['username']}: ${newUserBalance} \nКомиссия: ${tax} \nProfit: ${newProfitBalance}`
                messages.push([sendersID, message])

                //сообщение пользователю
                const userId = userRecord['id']
                message = `Вы обменяли ${args[1]} фишек \nВаш нынешний баланс: ${newUserBalance} \nВам должны выдать ${money}`
                messages.push([userId, message])
              } else {
                message = `Пользователь ${args[0]} не найден\n`
                messages.push([sendersID, message])
              }
            } else {
              message = `Вы неправильно воспользовались командой.\nНужно написать: \`/cashOut USERNAME VALUE\``
              messages.push([sendersID, message])
            }
          } else {
            messages.push([sendersID, "Access denied"])
          }
          break

        default:
          message = 'Нихуя не понял.\n' + rules
          messages.push([sendersID, message])
          break
      }

      for (let [id, message] of messages) {
        await bot.telegram.sendMessage(id, message, {
          parse_mode: 'Markdown'
        })
      }
    }

  } catch (error) {
    console.error('Error sending message')
    console.log(error.toString())
  }
})

bot.launch().then()

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"))
process.once("SIGTERM", () => bot.stop("SIGTERM"))