FROM node:24-alpine
WORKDIR /app
COPY skills/ ./skills/
COPY playbooks/ ./playbooks/
COPY mcp-server/ ./mcp-server/
WORKDIR /app/mcp-server
RUN npm ci && npm run build
ENV SKILLS_DIR=/app/skills
ENV PLAYBOOKS_DIR=/app/playbooks
CMD ["node", "dist/index.js"]
