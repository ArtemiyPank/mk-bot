const {Telegraf} = require("telegraf");
const dotenv = require("dotenv");
const Airtable = require("airtable");
const {generateUsername} = require("unique-username-generator");
const BigDecimal = require("js-big-decimal");

dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);

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


bot.on("text", async (request) => {
  try {
    // if (request.query.token !== process.env.ACCESS_TOKEN) {
    //   return
    // }

    Airtable.configure({
      apiKey: process.env.AIRTABLE_TOKEN
    })

    const base = Airtable.base(process.env.AIRTABLE_BASE_ID)

    if (request.message) {
      let {
        chat: {
          id: sendersID,
          username: sendersUsername
        },
        text
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
      4 - user can perform operations on the balance of other users(Command: /deposit <username> <value>; /cashOut <username> <value>)
      5 - in the development - user can give salary to shareholder(Command: /salary)
      8 - full access
      */

      const admins = [
        ['865114970', 8, 'Artemiy', 30],
        ['705440585', 4, 'Nikita', 15],
        ['708382963', 4, 'Yriy', 15],
        ['930912808', 3, 'Andrey', 15],
        ['1080883134', 2, 'Ilya', 5],
        // ['5739959347', 1, 'Test', 0]
      ]

      let accessLevel = 0
      for (const admin of admins) {
        if (admin[0] === sendersID.toString()) {
          accessLevel = admin[1]
          console.log("accessLevel -", accessLevel)
        }
      }

      // const admin = admins.includes(sendersID.toString())


      const sendersRecords = await base.table('balances').select({
        maxRecords: 1,
        filterByFormula: `{id}="${sendersID}"`
      }).firstPage()

      let sendersRecord
      if (sendersRecords.length !== 0) {
        sendersRecord = sendersRecords[0]
        sendersUsername = sendersRecord.get('handle')
      }

      console.log(sendersID, sendersUsername, text)

      let messages = []
      let message

      switch (command) {
        case '/start':
          if (sendersRecords.length === 0) {

            let repeatedUsername = await base.table('balances').select({
              maxRecords: 1,
              filterByFormula: `{handle}="${sendersUsername}"`
            }).firstPage()

            while (repeatedUsername.length !== 0 || sendersUsername === undefined) {
              sendersUsername = generateUsername("-", 0, 10)

              repeatedUsername = await base.table('balances').select({
                maxRecords: 1,
                filterByFormula: `{handle}="${sendersUsername}"`
              }).firstPage()
            }

            message = `Ваш username: ${sendersUsername}\n\nДля смены ника пропишите \`/rename НОВЫЙ_ЮЗЕРНЕЙМ\``
            messages.push([sendersID, message])

            //создание записи в DB
            await base.table('balances').create({
              handle: sendersUsername,
              balance: '0',
              id: sendersID
            }, async (err) => {
              if (err) {
                console.error(err)
              } else {
                message = `Ваш username - ${sendersUsername}\n` + rules
                messages.push([sendersID, message])
              }
            })

          } else {
            message = `Ваш username: ${sendersUsername}\n` + rules
            messages.push([sendersID, message])
          }
          break

        case '/rename':
          if (sendersRecords.length === 1) {
            if (args.length >= 1 && args.length < 3) {
              let currentRecord
              let newUsername
              if (args.length === 2) {
                if (accessLevel >= 3) {
                  let currentRecords = await base.table('balances').select({
                    maxRecords: 1,
                    filterByFormula: `{handle} = "${args[0]}"`
                  }).firstPage()
                  if (currentRecords.length != 0) {
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
              const withThisUsername = await base.table('balances').select({
                maxRecords: 1,
                filterByFormula: `{handle} = "${newUsername}"`
              }).firstPage()

              if (withThisUsername.length === 0) {

                currentRecord.set('handle', newUsername)
                await currentRecord.save()

                message = `Ваш username был изменён на ${newUsername}`
                messages.push([currentRecord.get('id'), message])
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

          const balances = await base.table('balances').select({
            filterByFormula: `OR({handle} = "${currentUsername}", {handle} = "profit")`
          }).firstPage()

          if (balances.length !== 2) {
            if (currentUsername === sendersUsername) {
              message = `Вы пока не зарегестрированы в системе, пропишите /start, чтобы это исправить`
            } else {
              message = `Пользователь ${currentUsername} не найден`
            }
            messages.push([sendersID, message])
            break
          }

          const profit = balances[0].get('id').toString() === '1' ? balances[0] : balances[1]
          const user = balances[0].get('id').toString() === sendersID.toString() ? balances[0] : balances[1]

          if (accessLevel === 0) {
            message = `Ваш баланс: ${user.get('balance')}`
          } else {
            message = `Баланс пользователя ${currentUsername}: ${user.get('balance')} \nПрофит кружка: ${profit.get('balance')}`

            //расчёт размера банка
            let totalBalance = '0'
            const records = await base.table('balances').select({}).all()
            records.forEach((record) => {
              totalBalance = BigDecimal.add(totalBalance, record.get('balance'))
            })

            message += '\nБаланс банка: ' + totalBalance
          }
          messages.push([sendersID, message])
          break

        case '/users':
          if (accessLevel >= 2) {
            let usersList = ''
            const records = await base.table('balances').select({}).all()

            //перебор всех записей в БД
            for (const record of records) {
              let currentUsername = record.get('handle')
              if (currentUsername !== 'profit') {
                usersList += `\`${currentUsername}\`: ${record.get('balance')}\n`
              }
            }
            messages.push([sendersID, usersList])
          } else {
            messages.push([sendersID, "Access denied"])
          }
          break

        case '/deposit':
          if (accessLevel >= 4) {
            if (args.length === 2) {

              const userRecords = await base.table('balances').select({
                maxRecords: 1,
                filterByFormula: `{handle} = "${args[0]}"`
              }).firstPage()

              if (userRecords.length > 0) {
                const userRecord = userRecords[0]
                const userBalance = userRecord.get('balance')
                const balanceChanging = args[1]

                //запись нового баланса
                const newBalance = BigDecimal.add(userBalance, balanceChanging)
                userRecord.set('balance', newBalance)
                await userRecord.save()

                //уведомление админа
                message = `Баланс пользователя \`${args[0]}\` теперь равен ${newBalance}`
                messages.push([sendersID, message])

                //уведомление получателя
                const userId = userRecord.get('id')
                const action = (Number(balanceChanging) < 0) ? 'уменьшился' : 'увеличился'
                message = `Ваш баланс ${action} на ${Math.abs(Number(balanceChanging))}\nТеперь он равен ${newBalance}`
                messages.push([userId, message])
              } else {
                message = `Пользователь ${args[0]} не найден`
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
            if (args.length === 2) {

              const records = await base.table('balances').select({
                filterByFormula: `OR({handle} = "${args[0]}", {handle} = "profit")`
              }).firstPage()

              if (records.length > 1) {
                if (records[0].get('handle') === 'profit') {
                  [records[0], records[1]] = [records[1], records[0]]
                }
                const recordUser = records[0]
                const recordProfit = records[1]

                const {money, tax} = countCashOut(args[1])

                //обновление баланса пользователя
                const userBalance = recordUser.get('balance')
                const newUserBalance = BigDecimal.subtract(userBalance, args[1])
                recordUser.set('balance', newUserBalance)
                await recordUser.save()

                //обновление профита
                const profitBalance = recordProfit.get('balance')
                const newProfitBalance = BigDecimal.add(profitBalance, tax)
                recordProfit.set('balance', newProfitBalance)
                await recordProfit.save()

                //сообщение админу
                message = `Нужно выдать: ${money} \nНынешний баланс пользователя ${recordUser.get('handle')}: ${newUserBalance} \nКомиссия: ${tax} \nProfit: ${newProfitBalance}`
                messages.push([sendersID, message])

                //сообщение пользователю
                const userId = recordUser.get('id')
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
  } catch
    (error) {
    console.error('Error sending message')
    console.log(error.toString())
  }
});

bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));