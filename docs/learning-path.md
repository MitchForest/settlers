Game Concept 1: <https://github.com/MitchForest/invisible-hand> 

- Research: 

  - Start with Austin’s friend’s tweet as starting point with AI to discuss ideas, themes, etc

  - Deep dive game theory / coordination games with AI

    - Iterated Prisoner's Dilemma

    - Colonel Blotto Game

    - Auction Theory w/ Information Asymmetry 

    - Stag Hunt

  - Research similar games:

    - **Victoria 3**: The main points of Victoria 3 can be distilled into three interconnected pillars: a deep societal simulation, a complex economic engine, and a dynamic political and diplomatic landscape.

    - **Crusader Kings III**: The main points of Crusader Kings III can be distilled into three interconnected pillars: dynastic and character-driven role-playing, a complex web of personal relationships and intrigue, and the management of a feudal realm through vassalage.

    - **Democracy 4**: The main points of Democracy 4 can be distilled into three interconnected pillars: a detailed simulation of individual voter moods and affiliations, a cause-and-effect policy system for enacting laws, and the strategic challenge of balancing the budget and political capital to ensure re-election.

- Game Concept v1

  - Based on research, have a back and forth with Claude and come up with the Game Concept v1

- Game Concept v2

  - Search reddit for threads related to “what makes a great strategy game” and create a document with posts and comments with lots of upvotes

  - Open Claude, Gemini, ChatGPT and ask each to synthesize the unorganized reddit texts into a coherent framework for what makes a good strategy game

  - Have Claude, Gemini, ChatGPT create specific feedback on how the original game concept could be improved based on the framework they created

  - Have Claude, Gemini, ChatGPT create a refined version of the original game concept based on their frameworks

  - Have Claude, Gemini, ChatGPT vote on the best refined concept (Claude won unanimously)

  - Have new chats from Claude, Gemini, ChatGPT compare the winning concept to the original game concept to see how it could be further improved/refined to align with my original vision

  - Provide the the feedback from all three to the Claude instance that wrote the Game Concept v2 and have it synthesize it into Game Concept v3

- Game Concept v3/v4

  - Take the game concept v3 and do one more round of feedback, synthesis, refinement to product the final game concept (v4)

- Game Concept v5

  - Concept will be pivoted based on prior research of similar games. The AI invisible hand took away too much agency from players and is in violation of the core theme of the game. Will make the AI more of a ‘game setter’ so no two games are the same instead of an ‘active interventionist’.

- Tech Stack & Requirements

  - Deep dive Ash’s suggested tech stack on Twitter, Reddit

  - Talk through pros and cons with Claude

  - Conclusion: **Your Game is UI-Driven, Not Physics-Driven:** "Invisible Hand" is fundamentally a game of interfaces. Players interact with buttons, sliders, dropdowns, and data visualizations. It's much more like a complex dashboard or a "board game on a screen" than a traditional video game like Mario or Asteroids. React and the DOM are the absolute best tools for building this kind of complex, data-driven UI. Phaser is not.

- Additional Research:

  - <https://forum.paradoxplaza.com/forum/developer-diary/victoria-3-dev-diary-142-2024-in-retrospect.1726056/> 

Game Concept 2: <https://github.com/MitchForest/sovereign-soil>

- Pivot to pixel farm sim

- Learn about what all of the different pieces that go into this (sprite sheets, etc)

- Get repo going with [Phaser.js](http://phaser.js) and Client/Server apps

- Find asset pack and purchase

- Load it into the repo and run into roadblock: assets are just one big png with all textures, objects, etc

- Explore different ways to map these to human and AI readable format (python pipeline; hiring someone on Fiverr lol; with AI came up with the idea to load into Tiled Map Maker and count and describe each square with what is inside ID, metadata description, etc)

- Tiled Map Maker kept crashing and freezing up my computer; find different version on github and try that (still often freezing but semi useable)

- Start doing this and look for other ways to do this

- Purchase Aesprite and watch youtube videos to learn

- Get pixels rendering on screen but body animations super jittery and look horrible

- Spend a few hours on this

- Start looking at pivots

Game Concept 3: https\://github.com/MitchForest/settlers

- Think through game concepts that are achievable, could generate a buzz on Twitter, and something I’d actually play. Settle on Catan

- Discuss stack with LLM and settle on <https://github.com/Hellenic/react-hexgrid> for game board

- Run into lots of issues with this and styling/animations

- Pivot to <https://github.com/IcculusC/react-hex-engine> which is a full game engine for hex games; after trying to implement decide its overkill for what I’m trying to do

- Try to implement <https://github.com/pixijs/pixijs/> with WebGL; also decide this is overkill

- Settle on what I know well–Next app, SVG rendering, Bun/Hono/Supabase/Drizzle backend, Websockets

- Start building

- Make decent progress on backend game engine and UI

- Still working on wiring everything together for a fully fleshed out single player experience

- Working on multiplayer concurrently

- Researching Monte Caro Tree Search, heuristic functions, pruning (as per Aaron Gallant’s guidance)

- Read <https://spronck.net/pubs/ACG12Szita.pdf> and come up with a mutli-step plan for AI agent once core functionality is in place
