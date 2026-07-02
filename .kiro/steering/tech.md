# Technical Stack

## Language & Runtime

- **TypeScript 5.7+**: Primary language for server logic
- **Node.js v14+**: Active LTS or greater
- **Target**: ES2019 with strict type checking enabled
- **Nakama Runtime**: Game server runtime environment

## Build System

- **Rollup**: Module bundler for compiling TypeScript to single JavaScript output
- **Babel**: Transpiler for ES5 compatibility
- **TypeScript Compiler**: Type checking and compilation

### Build Output
- Source: `src/main.ts` (entry point)
- Output: `build/index.js` (bundled server code)

## Key Dependencies

### Runtime Dependencies
- `nakama-runtime`: Core Nakama server APIs and type definitions
- `inversify`: Dependency injection container
- `lodash`: Utility library
- `reflect-metadata`: Metadata reflection for decorators
- `valibot`: Schema validation library

### Dev Dependencies
- `eslint` + `@typescript-eslint`: Linting
- `prettier`: Code formatting
- `jest` + `ts-jest`: Testing framework
- `husky`: Git hooks management
- `commitlint`: Conventional commit enforcement

## Docker Environment

The project runs in Docker containers orchestrated by Docker Compose:
- **postgres**: PostgreSQL 17.4 database
- **nakama**: Game server container (built from Dockerfile)
- **tf**: TensorFlow Serving for ML models

## Common Commands

### Development
```bash
npm run start          # Type check and start with docker compose
npm run build          # Bundle TypeScript to JavaScript with Rollup
npm run type-check     # Run TypeScript compiler without emitting files
npm run lint           # Run ESLint on source files
npm run test           # Run Jest test suite
```

### Docker Operations
```bash
docker compose up --build nakama    # Build and start all services
docker compose up -d --build nakama # Rebuild server code without logs
docker compose down                 # Stop all containers
docker compose down -v              # Stop containers and remove volumes
```

## Code Quality Tools

- **ESLint**: Configured with TypeScript, Prettier, and SonarJS plugins
- **Prettier**: Enforced code formatting
- **Husky**: Pre-commit and commit-msg hooks
- **Commitlint**: Conventional commits standard
- **Jest**: Unit testing with ts-auto-mock for mocking

## TypeScript Configuration

- Strict mode enabled
- Experimental decorators and decorator metadata
- Module resolution: NodeNext
- No implicit returns or unused locals
- Comments removed from output
