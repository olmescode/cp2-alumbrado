# CLAUDE.md

## Project Overview

Airport Tycoon 2 is a Roblox tycoon game with aviation gameplay.

## Development Setup & Commands

**Project management**: (`default.project.json`)
- The project maps `src/` subdirectories to Roblox DataModel services

## Architecture

### Entry Points

- **Server**: `src/ServerScriptService/ServerScript/init.server.lua`
  - Spawns `PrepareWorld` first (priority), then loads all services from `ServerStorage/Services` concurrently, then loads components from `ServerStorage/Components`
- **Client**: 
  `src/StarterPlayer/StarterPlayerScripts/init.client.lua`
  - Initializes `Controllers`, `Components`
  `src/ReplicatedFirst/Source/start.server.lua`
  - Initializes `UISetup`, then waits for `waitForGameLoadedAsync()`

### Code Organization

```
src/
├── ReplicatedFirst/Source/       # Client entry point + load utilities
├── ReplicatedStorage/
│   ├── Source/                   # Shared singletons (New UI, signals, utilities)
│   ├── Scripts/
│   │   ├── Libraries/            # Frameworks: ByteNet, StateService, DataService, Component, etc.
│   │   ├── Configurations/       # All game content config (planes, vehicles, gamepasses, etc.)
│   │   ├── Utilities/            # Shared helpers (Tween, Sound, Shake, FormatNumber, etc.)
│   │   └── GuiEffects/           # UI animation helpers (Removed)
│   ├── Controllers/              # Client-side logic (OLD UI controllers (Removed), platform/input)
│   ├── Components/               # Client-side object components (TycoonClient, NPCs, etc.)
│   └── Packets/                  # ByteNet packet definitions (General.lua, Tycoon.lua)
├── ServerScriptService/          # Server entry point + admin commands
└── ServerStorage/
    ├── Services/General/         # Server services (TycoonService, PlaneService, etc.)
    ├── Components/               # Server-side object components (TycoonServer, doors, conveyors, etc.)
    └── Assets/                   # Aircraft models (25+), vehicle scripts
```

## Core Principles

### I. Single Entry Point Architecture
The project utilizes a centralized initialization pattern to ensure deterministic execution order.
- **Client**: A single `LocalScript` (typically in `ReplicatedFirst`) acts as the entry point for all client-side code.
- **Server**: A single `Script` (in `ServerScriptService`) acts as the entry point for all server-side code.

### II. Singleton-Based Systems
Top-level systems (e.g., `Network`, `PlayerData`) are implemented as Singletons.
- These are non-instantiable ModuleScripts that return a table of methods and state.
- They are initialized explicitly by the client or server entry scripts.
- **Pattern**: Methods are called with dot syntax (`System.method()`) rather than colon syntax, as there is no instance.

### III. Strict Typing (NON-NEGOTIABLE)
All scripts must use `--!strict` mode to leverage Luau's type inference.
- **Class Definitions**: Use the specific pattern of duplicating `self` definition in type and constructor to ensure correct type inference.
- **Type Casting**: Use explicit casting (e.g., `:: number`) after logical guards if the type engine does not narrow automatically.
- **DataModel Traversal**: Use safe wrappers (like a `getInstance` utility) for traversing the DataModel hierarchy instead of unsafe `any` casts.

### IV. Communication Hierarchy
Client-Server communication must follow this order of preference to minimize complexity and race conditions:
1.  **Player Data Replication**: Use the PlayerData system for persistent state (Coins, Inventory, FTUE stage).
2.  **Attributes**: Use Instance Attributes for object-specific state (Plant growth, interaction status).
3.  **CollectionService Tags**: Use Tags for categorizing objects and replicating behavior (CanPlant, Enemy).
4.  **Network Module**: Use direct `RemoteEvent`/`RemoteFunction` calls only for specific transactional requests (Watering, Buying) that cannot be handled by the above.

### V. Composition Over Inheritance
Classes extend functionality through composition rather than metatable inheritance.
- "Child" objects are instantiated within the `new()` method of the parent and stored as members.
- **Cleanup**: All instantiable classes must implement a `destroy()` method (lowercase 'd') to clean up connections, instances, and child objects.

### User Interface
- **Imperative Approach**: UI is managed imperatively to maintain clear visibility of transformations.
- **Layers & Components**:
    - **Layers**: Top-level Singletons (e.g., `Inventory`, `HUD`) managed by a `UIHandler`.
    - **Components**: Reusable instantiable classes (e.g., `Button`, `ListItem`).
- **View Management**:
    - **HUD**: Visible by default, hidden when menus are open.
    - **Menus**: Stack-based visibility. Only one menu is active at a time; closing one reveals the previous one.

## Testing & Validation

Never claim behaviour is verified without having run it. Use the Roblox Studio MCP server as the primary testing tool, and prefer it over reasoning about what the code "should" do.

- **Instance and hierarchy validation**: use `inspect_instance` and `search_game_tree` to read the real structure, properties, attributes and tags of any instance. Assets live in the place file, not in `src/`, so this is the only way to see them.
- **Logic and data validation**: use `execute_luau` to run the real logic against real place data and print the results. Compare old behaviour against new when changing a calculation.
- **Runtime testing**: use `start_stop_play` to enter Play, `user_mouse_input` / `user_keyboard_input` to drive the game, `screen_capture` to see the result, and `get_console_output` to read errors.
- **Performance profiling**: use `SceneAnalysisService` through `execute_luau` for instance, script, triangle, audio and animation memory, and for leak detection.

Review the available MCP tools and use whichever fits the task; the list above is not exhaustive.

## Documentation & Verification

Never assume how a Roblox API behaves. Verify before writing code that depends on it.

- Use the **roblox-docs-lookup** skill to consult the official documentation for any class, service, method, property, event, parameter or context restriction. Answer strictly from what the file says.
- Web search results and forum answers are not authoritative. Treat them as hints to verify, never as the basis for a decision.
- Call `advisor` when the correct use of an API is load-bearing for the design, or spawn an agent to review that Roblox methods are being used correctly.

If an API's behaviour cannot be confirmed, state the uncertainty and the assumption made rather than presenting a guess as fact.

## Governance

### Code Standards
- **Naming**: Use `camelCase` for methods and variables. Use `PascalCase` for Class names and Roblox Services.
- **Cleanup**: The `destroy()` method is mandatory for any class that creates instances or connections.
- **Singletons**: Require the ModuleScript directly to access the singleton.

### Design Principles
- Follow SOLID principles, with emphasis on clear separation of concerns.

### Code Style & Readability
- Write elegant code; elegant means simple, clean, and easy to read—using the least amount of code possible for the best future readability.
- Use syntactic sugar when appropriate to improve readability and conciseness.
- Avoid structures with multiple nested `if` statements or unnecessary guard clauses; prefer clean and direct flow control.
- All `game:GetService(...)` calls go at the top, followed by all `require(...)` calls. Use full names.
- All variable names must be complete words and clearly describe what they represent — never use generic names like `data`, `result`, `value`, `text`, or `image` when a more specific name is available.
- Never chain method calls inline (e.g. `Foo():Bar()`). Always assign the result to a named variable first, then call the method on the next line.
- ModuleScripts must always declare a named local variable and return it at the end. Never use `return {}` directly. Example: `local Foo = {} ... return Foo`.
- Never compare against `nil`, `true`, or `false`. Use `if value` to test for presence or truth, and `if not value` to test for absence or falsity. Never write `== nil`, `~= nil`, `== true`, `~= true`, or `== false`.

### Output Constraints
- Do not add comments to the code.
- Do not generate emojis, praise, or condescending language.
- Do not introduce additional functions, abstractions, or files unless explicitly requested.