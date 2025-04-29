# Poker Management App

A simple mobile-friendly poker management app for physical poker games. This app provides tools to create poker tables and manage players during in-person poker games.

## Features

- Create poker tables with custom blinds
- Add and remove players
- Track chip counts
- Adjust player chips during the game
- Mobile-friendly interface
- Automatic database backups

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
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

## License

This project is licensed under the MIT License.

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
