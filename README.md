# Settlers

A settlers game application.

## Stack

- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Bun with Hono framework
- **Database**: PostgreSQL with Drizzle ORM
- **Build System**: Turborepo monorepo
- **Package Manager**: Bun

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- PostgreSQL database running

### Installation

```bash
# Install dependencies
bun install

# Start development servers
bun dev
```

This will start:
- Frontend at `http://localhost:3000`
- Backend at `http://localhost:4000`

### Project Structure

```
settlers/
├── apps/
│   ├── frontend/          # Next.js frontend
│   └── backend/           # Bun backend with Hono
├── packages/
│   ├── core/              # Shared types and utilities
│   ├── ui/                # Shared UI components
│   ├── eslint-config/     # ESLint configurations
│   └── typescript-config/ # TypeScript configurations
└── README.md
```

## Development

- `bun dev` - Start all development servers
- `bun build` - Build all packages
- `bun test` - Run tests
- `bun lint` - Run linting
- `bun db:migrate` - Run database migrations

## Architecture

This is a monorepo using Turborepo with:
- Shared packages for common code
- Type-safe API communication
- Modern React with server components
- Responsive design with Tailwind CSS
