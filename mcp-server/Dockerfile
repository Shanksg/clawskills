FROM node:20-alpine
WORKDIR /app
COPY skills/ ./skills/
COPY mcp-server/ ./mcp-server/
WORKDIR /app/mcp-server
RUN npm ci && npm run build
ENV SKILLS_DIR=/app/skills
CMD ["node", "dist/index.js"]
