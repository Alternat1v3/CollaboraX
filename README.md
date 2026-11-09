# CollaboraX

A full-stack app for small teams: shared workspaces, projects, a drag-and-drop Kanban board and real-time chat.

**[Live demo](https://moonlit-salamander.netlify.app/)** (register an account to try it)

## Features

- **Accounts:** sign-up and login with bcrypt-hashed passwords and JWT sessions
- **Teams and projects:** create a team, invite members and organise work into projects
- **Kanban board:** drag tasks between columns (dnd-kit)
- **Real-time chat:** conversations and messages over Socket.io, with live updates
- **File uploads:** images and attachments stored on Cloudinary

## Stack

| Layer | Tech |
| --- | --- |
| Client | React, TypeScript, Vite, Tailwind CSS, React Router, dnd-kit, socket.io-client |
| Server | Node.js, Express 5, Socket.io, Mongoose |
| Data | MongoDB, Cloudinary (files) |

## Project layout

```
client/            React app (Vite)
server/models/     User, Team, Project, Task, Conversation, Message
server/routes/     auth, users, team, project, task, chat, upload
server.js          Express + Socket.io entry point
```

## Run it locally

1. Create a `.env` in the project root:

   ```
   MONGODB_URI=...
   JWT_SECRET=...
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```

2. Start the server:

   ```bash
   npm install
   npm run dev
   ```

3. Start the client (in a second terminal). Set `VITE_API_URL` in `client/src/.env` to the server address, for example `http://localhost:5000`:

   ```bash
   cd client
   npm install
   npm run dev
   ```
