# MK-Bot

MK-Bot is a Telegram bot for storing and analyzing poker game data. It keeps track of chip balances for players, supports basic administration commands, and provides simple bank statistics. The bot relies on a SQLite database and can be deployed locally or with Docker.

## Features

- **User registration** via the `/start` command with automatic username assignment if needed
- **User rename** functionality through `/rename NEW_USERNAME`
- **Balance tracking** with `/balance` and optional username argument for admins
- **Bank overview** listing all users via `/users` (admin only)
- **Deposit management** using `/deposit USERNAME VALUE` (admin only)
- **Cash out** through `/cashOut USERNAME VALUE`, applying a commission to the `profit` account

Access levels are defined in the code and determine which commands a user can execute. Regular users may only view their own balance, while administrators can adjust balances or view all users.

## Getting Started

### Prerequisites

- Node.js 16 or later
- npm (comes with Node.js)
- A Telegram bot token, available from [@BotFather](https://t.me/BotFather)

### Installation

Clone the repository and install dependencies:

```bash
npm install
```

Create a `.env` file in the project root and define the bot token:

```bash
BOT_TOKEN=your-telegram-bot-token
```

### Database Setup

The bot stores information in a SQLite database located at `mk-bot_db/mk-bot_db.sqlite`. Ensure the `mk-bot_db` directory exists and is writable. The database should contain a `users` table with the following fields:

- `id` – Telegram user ID (primary key)
- `username` – unique username used by the bot
- `balance` – current chip balance

An additional record with `username` set to `profit` is used to store commissions collected from cash outs.

### Running Locally

After configuring the `.env` file and ensuring the database is set up, start the bot:

```bash
node index.js
```

The bot will connect to Telegram and begin polling for messages.

### Running with Docker

A `Dockerfile` and `docker-compose.yml` are provided. Build and run the container with:

```bash
docker-compose up --build
```

Make sure the `.env` file is present before running Docker so the container has access to the bot token. The compose file mounts a volume named `users-db` to persist the SQLite database.

## Usage

Interact with the bot through Telegram. Below is a summary of key commands:

| Command                         | Description                                             |
|---------------------------------|---------------------------------------------------------|
| `/start`                        | Register in the system and receive your username        |
| `/rename NEW_USERNAME`          | Change your username                                    |
| `/balance`                      | Show your balance                                       |
| `/balance USERNAME`             | (Admin) View another user's balance                     |
| `/users`                        | (Admin) List all users and their balances               |
| `/deposit USERNAME VALUE`       | (Admin) Adjust a user's balance                         |
| `/cashOut USERNAME VALUE`       | (Admin) Cash out chips for a user with commission       |

Balancing rules and commission rates are defined in the source code. When cashing out, 15% is transferred to the `profit` account. Use `/balance` to review your current balance.
