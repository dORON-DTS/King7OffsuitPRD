# Poker Management App

<<<<<<< HEAD
A simple mobile-friendly poker management app for physical poker games. This app provides tools to create poker tables and manage players during in-person poker games.

## Features

- Create poker tables with custom blinds
- Add and remove players
- Track chip counts
- Adjust player chips during the game
- Mobile-friendly interface
- Automatic database backups
=======
A comprehensive mobile-friendly poker management app for physical poker games. This app provides tools to create poker tables, manage players, track buy-ins and cash-outs, and view statistics during in-person poker games.

## Features

- Create and manage multiple poker tables
- Track players, buy-ins, and cash-outs
- Real-time chip count management
- Player statistics and history
- Table balance tracking
- Mobile-friendly interface
- Dark mode design
- Secure authentication system
- Admin and editor roles
>>>>>>> 9f3b28b883993b214415a4d9f59581c45756c51d

## Getting Started

### Prerequisites

<<<<<<< HEAD
- Node.js (v14 or higher)
- npm or yarn
=======
- Node.js (v18.x)
- npm or yarn
- SQLite3
>>>>>>> 9f3b28b883993b214415a4d9f59581c45756c51d

### Installation

1. Clone the repository
2. Install dependencies:
<<<<<<< HEAD
```
npm install
```
3. Start the development server:
```
npm start
```

## Usage

1. Create a new poker table by clicking the "Create New Table" button
2. Enter table details like name, small blind, and big blind
3. Add players to the table with their starting chip counts
4. Manage player chips during the game

## Technologies Used

- React
- TypeScript
- Material UI
- React Router

## Mobile Setup

The app is designed to be mobile-friendly and can be added to your home screen on mobile devices for a better experience.
=======
```bash
npm install
```
3. Create the data directory:
```bash
mkdir -p data
```
4. Start the development server:
```bash
# Start the React development server
npm start

# In a separate terminal, start the backend server
npm run server
```

## Production Deployment

The app is configured for deployment on Render.com. The deployment configuration is specified in `render.yaml`.

### Environment Variables

- `NODE_ENV`: Set to 'production' for production environment
- `PORT`: The port number for the server (default: 10000)

### Database

The app uses SQLite3 for data storage. In production, the database file is stored in a persistent disk volume mounted at `/opt/render/project/src/data`.

## Usage

1. Create a new poker table by clicking the "Create New Table" button
2. Enter table details including name, small blind, big blind, and location
3. Add players to the table with their starting chip counts
4. Track buy-ins and manage chip counts during the game
5. Cash out players when they leave
6. View statistics and history in the Statistics section

## Technologies Used

- React 18
- TypeScript
- Material UI v5
- React Router v6
- Express.js
- SQLite3
- JSON Web Tokens for authentication

## Mobile Setup

The app is designed to be mobile-friendly and can be added to your home screen on mobile devices for a better experience. It features a responsive design that works well on both desktop and mobile devices.
>>>>>>> 9f3b28b883993b214415a4d9f59581c45756c51d

## License

This project is licensed under the MIT License.
<<<<<<< HEAD

## Production Version 1.9.6

### System Requirements
- Node.js 18.x
- SQLite3

### Production Deployment
This application is configured for deployment on Render.com. The deployment process is automated through the `render.yaml` configuration file.

### Environment Variables
- `NODE_ENV`: Set to 'production' in production environment
- `PORT`: Set to 10000 in production environment

### Database
The application uses SQLite3 with the database file stored in the `data` directory. The database is automatically initialized on first run.

#### Database Backups
- Automatic daily backups are performed at midnight
- Backups are stored in the `data/backups` directory
- Each backup file is named with a timestamp (e.g., `poker_2024-04-29T12-00-00-000Z.db`)
- The backup system ensures data persistence and recovery options

### API Endpoints
The server exposes various REST API endpoints for managing poker games, players, and statistics. All endpoints are prefixed with `/api/`.

### Security
- CORS is configured to only allow requests from the production domain in production environment
- Password hashing is implemented for user authentication
- Role-based access control is implemented
- Development endpoints have been removed from production

### Build Process
1. Install dependencies: `npm install`
2. Build the application: `npm run build`
3. Start the server: `npm run server`

### Production Notes
- The application uses a persistent disk on Render for data storage
- Error handling middleware is implemented for production
- Request logging is enabled for monitoring
- Database backups are performed automatically
=======
>>>>>>> 9f3b28b883993b214415a4d9f59581c45756c51d
