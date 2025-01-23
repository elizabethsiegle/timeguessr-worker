import { describe } from 'vitest';
import html from '../static/index.html';

// Add this at the top of the file
const FRONTEND_JS = `window.TimeGuessr = class TimeGuessr {
  constructor() {
    this.playerId = crypto.randomUUID();
    this.sessionId = new URLSearchParams(window.location.search).get('session') || 'default';
    this.baseUrl = window.location.origin;
  }

  async joinGame(playerName) {
    try {
      console.log('Joining game with:', { playerId: this.playerId, playerName });
      const response = await fetch(\`\${this.baseUrl}/join?session=\${this.sessionId}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerId: this.playerId, playerName })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(\`Failed to join game: \${errorText}\`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Error joining game:', error);
      throw error;
    }
  }

  async makeGuess(year) {
    try {
      const response = await fetch(\`\${this.baseUrl}/guess?session=\${this.sessionId}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerId: this.playerId, guessedYear: year })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(\`Failed to submit guess: \${errorText}\`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Error making guess:', error);
      throw error;
    }
  }

  async getGameStatus() {
    try {
      const response = await fetch(\`\${this.baseUrl}/status?session=\${this.sessionId}\`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(\`Failed to get status: \${errorText}\`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Error getting game status:', error);
      throw error;
    }
  }
}`;

export class GameSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
    // Define CORS headers as a class property
    this.corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }

  async fetch(request) {
    try {
      await this.initialize();
      const url = new URL(request.url);
      
      // Handle OPTIONS requests for CORS
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: this.corsHeaders
        });
      }
      
      console.log('Fetch request path:', url.pathname);
      
      if (request.method === 'GET' && url.pathname === '/') {
        return new Response(html, {
          headers: { 
            'Content-Type': 'text/html',
            ...this.corsHeaders 
          },
        });
      }

      if (request.method === 'GET' && url.pathname === '/frontend.js') {
        return new Response(FRONTEND_JS, {
          headers: { 
            'Content-Type': 'application/javascript',
            ...this.corsHeaders 
          },
        });
      }
      
      // Add CORS headers to all API responses
      const response = await this.handleSession(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(this.corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
      
    } catch (error) {
      console.error('Error in fetch:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...this.corsHeaders
        }
      });
    }
  }

  async initialize() {
    try {
      let gameState = await this.storage.get('gameState');
      console.log('Current gameState:', gameState);
      
      if (!gameState) {
        gameState = {
          players: {},
          currentRound: 0,
          maxRounds: 5,
          images: [],
          scores: {},
          status: 'waiting'
        };
        console.log('Initializing new gameState:', gameState);
        await this.storage.put('gameState', gameState);
      }
    } catch (error) {
      console.error('Error in initialize:', error);
      throw error;
    }
  }

  async handleSession(request) {
    try {
      const url = new URL(request.url);
      const action = url.pathname.split('/')[1];
      let gameState = await this.storage.get('gameState');

      console.log('HandleSession:', { action, method: request.method });

      switch (action) {
        case 'join':
          if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: {
                'Content-Type': 'application/json',
                'Allow': 'POST'
              }
            });
          }
          return this.handleJoin(request, gameState);
        
        case 'guess':
          if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: {
                'Content-Type': 'application/json',
                'Allow': 'POST'
              }
            });
          }
          return this.handleGuess(request, gameState);
        
        case 'status':
          if (request.method !== 'GET') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: {
                'Content-Type': 'application/json',
                'Allow': 'GET'
              }
            });
          }
          return new Response(JSON.stringify(gameState), {
            headers: {
              'Content-Type': 'application/json'
            }
          });

        case 'removePlayer':
          if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: {
                'Content-Type': 'application/json',
                'Allow': 'POST'
              }
            });
          }
          
          const { playerId } = await request.json();
          console.log('Removing player:', playerId);
          
          if (!gameState) {
            return new Response(JSON.stringify({ error: 'No game in progress' }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json'
              }
            });
          }
          
          // Remove player from game state
          if (gameState.players && gameState.scores) {
            delete gameState.players[playerId];
            delete gameState.scores[playerId];
            
            // Save updated game state
            await this.storage.put('gameState', gameState);
            
            return new Response(JSON.stringify({ 
              message: 'Player removed successfully',
              gameState 
            }), {
              headers: {
                'Content-Type': 'application/json'
              }
            });
          }
          
          return new Response(JSON.stringify({ error: 'Player not found' }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        
        default:
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json'
            }
          });
      }
    } catch (error) {
      console.error('Error in handleSession:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }

  async handleJoin(request, gameState) {
    try {
      const { playerId, playerName } = await request.json();
      console.log('Join request:', { playerId, playerName });

      if (!gameState) {
        console.log('Creating new game state');
        gameState = {
          players: {},
          currentRound: 0,
          maxRounds: 5,
          images: [],
          scores: {},
          status: 'waiting'
        };
      }

      // Check for duplicate names (case-insensitive)
      const isDuplicateName = Object.values(gameState.players)
        .some(name => name.toLowerCase() === playerName.toLowerCase());
      
      if (isDuplicateName) {
        return new Response(JSON.stringify({ 
          error: 'This name is already taken' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add the player
      gameState.players[playerId] = playerName;
      gameState.scores[playerId] = 0;

      // Start game immediately for single player
      console.log('Starting game for new player');
      gameState = await this.startGame(gameState);

      console.log('Saving game state:', gameState);
      await this.storage.put('gameState', gameState);
      
      return new Response(JSON.stringify(gameState), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error in handleJoin:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async handleGuess(request, gameState) {
    try {
      const { playerId, year } = await request.json();
      
      if (!playerId) {
        return new Response(JSON.stringify({ error: 'Player ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!gameState || gameState.status !== 'active') {
        return new Response(JSON.stringify({ error: 'No active game' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate player exists in game
      if (!gameState.players[playerId]) {
        return new Response(JSON.stringify({ error: 'Player not found in game' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Initialize score if it doesn't exist
      if (typeof gameState.scores[playerId] !== 'number') {
        gameState.scores[playerId] = 0;
      }

      const currentImage = gameState.images[gameState.currentRound];
      if (!currentImage || !currentImage.actualYear) {
        return new Response(JSON.stringify({ error: 'No image data available' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Calculate score
      const difference = Math.abs(currentImage.actualYear - year);
      let points = 0;
      
      if (difference === 0) {
        points = 100;
      } else if (difference <= 5) {
        points = 90;
      } else if (difference <= 10) {
        points = 80;
      } else if (difference <= 20) {
        points = 60;
      } else if (difference <= 50) {
        points = 40;
      } else {
        points = Math.max(0, 30 - Math.floor(difference / 10));
      }

      // Update player's score
      gameState.scores[playerId] = (gameState.scores[playerId] || 0) + points;

      // Move to next round if this wasn't the last one
      if (gameState.currentRound < gameState.maxRounds - 1) {
        gameState.currentRound++;
      } else {
        gameState.status = 'completed';
      }

      await this.storage.put('gameState', gameState);

      return new Response(JSON.stringify({
        points,
        actualYear: currentImage.actualYear,
        difference: year - currentImage.actualYear,
        totalScore: gameState.scores[playerId],
        gameState
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error in handleGuess:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async generateGameImages() {
    const historicalImages = {
      iwo_jima: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Raising_the_Flag_on_Iwo_Jima%2C_larger.jpeg/240px-Raising_the_Flag_on_Iwo_Jima%2C_larger.jpeg',
        actualYear: 1945,
        description: 'Marines raising the American flag on Mount Suribachi, Iwo Jima'
      },
      nato_signing: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Truman_signing_North_Atlantic_Treaty.jpg/1507px-Truman_signing_North_Atlantic_Treaty.jpg?20120314142514',
        actualYear: 1949,
        description: 'President Truman signing the North Atlantic Treaty'
      },
      wright_flight: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Katharine_Wright%27s_First_Time_Flying.jpg/240px-Katharine_Wright%27s_First_Time_Flying.jpg',
        actualYear: 1909,
        description: "Katharine Wright's first flight with Wilbur"
      },
      golden_gate: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Aerial_Photograph_of_the_Golden_Gate_Bridge_being_Constructed_in_San_Francisco%2C_California_-_NARA_-_7455640.jpg/240px-Aerial_Photograph_of_the_Golden_Gate_Bridge_being_Constructed_in_San_Francisco%2C_California_-_NARA_-_7455640.jpg',
        actualYear: 1935,
        description: 'Aerial view of Golden Gate Bridge under construction'
      },
      picasso: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Pablo_picasso_1.jpg/460px-Pablo_picasso_1.jpg',
        actualYear: 1962,
        description: "Picasso smiling"
      },
      battleofthesexes: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Billie_Jean_King_and_Bobby_Riggs_1973.jpg/196px-Billie_Jean_King_and_Bobby_Riggs_1973.jpg',
        actualYear: 1973,
        description: "Billie Jean King and Bobby Riggs"
      },
      stephcurry: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Stephen_Curry%2C_Olympic_Games_2024.jpg/193px-Stephen_Curry%2C_Olympic_Games_2024.jpg',
        actualYear: 2024,
        description: "Stephen Curry at the Olympic Games"
      },
      steveballmer: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Steve_Ballmer_-_MIX_2008.jpg/240px-Steve_Ballmer_-_MIX_2008.jpg',
        actualYear: 2008,
        description: "Steve Ballmer at MIX 2008"
      },
      stevejobs: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Steve_Jobs_Headshot_2010-CROP_%28cropped_2%29.jpg/240px-Steve_Jobs_Headshot_2010-CROP_%28cropped_2%29.jpg',
        actualYear: 2010,
        description: "Steve Jobs presenting iPhone 4 on stage at WWDC 2010"
      },
      phillygiants: {
        url:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/1902_Philadelphia_Giants.jpg/240px-1902_Philadelphia_Giants.jpg',
        actualYear: 1902,
        description: "Negro LeaguesPhiladelphia Giants team portrait"
      },
      baberuth_lougehrig: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/2/26/Babe_Ruth_%26_Lou_Gehrig_at_West_Point_1927.jpg?20220417041545',
        actualYear: 1927,
        description: "Babe Ruth and Lou Gehrig at West Point"
      }
    };

    // Convert dictionary to array and shuffle
    const imageArray = Object.values(historicalImages);
    const shuffledImages = this.shuffleArray([...imageArray]);

    // Take first 5 images (or less if not enough images)
    return shuffledImages.slice(0, 5);
  }

  // Fisher-Yates shuffle algorithm
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  async startGame(gameState) {
    try {
      console.log('Starting game with state:', gameState);
      
      // Generate random images first
      const images = await this.generateGameImages();
      console.log('Generated images:', images);

      // Update game state with images and status
      gameState.status = 'active';
      gameState.images = images;
      gameState.currentRound = 0;
      
      // Save the updated state
      await this.storage.put('gameState', gameState);
      
      console.log('Game started with state:', {
        status: gameState.status,
        imageCount: gameState.images.length,
        currentRound: gameState.currentRound,
        firstImageUrl: gameState.images[0]?.url
      });
      
      return gameState;
    } catch (error) {
      console.error('Error in startGame:', error);
      throw new Error(`Failed to start game: ${error.message}`);
    }
  }
}

export default {
  async fetch(request, env, ctx) {
	  const ai = env.AI;
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session') || 'default';
    
    const id = env.GAME_SESSIONS.idFromName(sessionId);
    const obj = env.GAME_SESSIONS.get(id);
    
    return obj.fetch(request);
  }
};
