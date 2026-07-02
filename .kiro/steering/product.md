# Product Overview

This is a **Nakama game server project template** demonstrating how to build custom server-side game logic for multiplayer games.

## What is Nakama?

Nakama is an open-source game server that provides backend services for online games including:
- User authentication and accounts
- Storage and persistence
- Real-time multiplayer matches
- RPC (Remote Procedure Call) endpoints
- Virtual wallets and in-game economy
- Notifications

## Current Features

This template includes:
- **Shop System**: Players can browse shop items, manage inventory, and purchase items
- **Authentication Hooks**: Custom logic that runs after device authentication
- **RPC Endpoints**: Server functions callable by game clients
- **Match System** (commented out): Authoritative multiplayer match handler for turn-based games
- **AI/ML Integration**: TensorFlow Serving container for machine learning models

## Purpose

This is a starting point for building game server logic in TypeScript. It demonstrates common patterns like storage operations, wallet updates, and RPC function registration.
