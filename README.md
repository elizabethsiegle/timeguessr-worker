# TimeGuessr 🕰️

A fun version of the game [TimeGuessr](https://timeguessr.com/) where players guess the year historical photos were taken. Built with Cloudflare Workers, Durable Objects and vanilla JavaScript.

## 🎮 How to Play

1. Enter your username to join the game
2. Look at the historical photograph
3. Make your best guess about which year the photo was taken
4. Score points based on how close your guess is to the actual year
5. Try to get the highest score on the leaderboard!

## 📝 Scoring System

- Exact year: 100 points
- Within 5 years: 90 points
- Within 10 years: 80 points
- Within 20 years: 60 points
- Within 50 years: 40 points
- Over 50 years: Points decrease with distance

## 🛠️ Technical Stack

- Frontend: Vanilla JavaScript, HTML, CSS
- Backend: Cloudflare Workers
- Storage: Cloudflare Durable Objects
- Images: Historical photographs from Wikimedia Commons

## 🚀 Development

1. Clone the repository
2. Install Wrangler CLI: `npm install -g @cloudflare/wrangler`
3. Run `wrangler dev` to start the development server
4. Open `http://localhost:8787` in your browser to play the game

## 🤝 Contributing

Feel free to fork this repository and submit a pull request with your improvements.
