# Project Overview

This is an **Enterprise AI Knowledge Base / QA Assistant** built as a modern web application. It allows users to ask questions and receive answers based on retrieved context from uploaded documents using Retrieval-Augmented Generation (RAG).

## Key Features
- **Streaming AI Answers:** Real-time generation of responses using Server-Sent Events (SSE) / JSONL streaming.
- **RAG over Uploaded Documents:** Embeds user questions and searches for similar document chunks in a vector database before prompting the LLM.
- **Configurable LLM Providers:** Supports multiple providers (OpenAI, SiliconFlow, Zhipu) via environment configuration.
- **Chat History & State Management:** Manages message history, agent steps, and document sources.

## Tech Stack & Architecture
- **Framework:** [Next.js 15](https://nextjs.org/) (App Router).
- **Language:** TypeScript.
- **UI & Styling:** React 19, [Tailwind CSS v4](https://tailwindcss.com/), Markdown rendering with LaTeX and code highlighting (`react-markdown`, `katex`, `highlight.js`).
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) (Centralized in `src/store/chatStore.ts` to separate business logic from UI).
- **Database & Vector Search:** [Supabase](https://supabase.com/) (using pgvector via RPC `match_documents` for similarity search).
- **AI / LLM Layer:** Official `openai` Node SDK for chat completions and `@langchain/openai` for embeddings. 

## Building and Running

### Prerequisites
Ensure you have Node.js version 20 or higher (`engines: node >=20`).

You will need to set up environment variables (typically in a `.env.local` file):
- `AI_API_KEY`: Required for your chosen AI provider.
- `AI_PROVIDER`: Optional. Choices are `openai` (default), `siliconflow`, or `zhipu`.
- `AI_MODEL`: Optional. Overrides the default model for the chosen provider.
- `AI_BASE_URL`: Optional. Custom base URL for the API.
- `DEFAULT_WORKSPACE_ID`: Used by Supabase RPC queries to scope searches.
- Supabase connection strings (likely `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` or similar backend keys).

### Commands
- **Install dependencies:**
  ```bash
  npm install
  ```
- **Run the development server:**
  ```bash
  npm run dev
  ```
  Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
- **Build for production:**
  ```bash
  npm run build
  ```
- **Start production server:**
  ```bash
  npm run start
  ```
- **Typechecking & Linting:**
  ```bash
  npm run typecheck
  npm run lint
  ```

## Development Conventions & Notes

- **Separation of Concerns (State vs. UI):** Complex business logic, such as the `sendMessage` function handling streaming responses and RAG configurations (topK, threshold), is managed within Zustand (`useChatStore`). React components mainly focus on presentation.
- **Streaming Response Protocol:** The API (`/api/ask`, `/api/search`) returns a streaming response. The client expects custom JSON structures for different events (`type: "sources"`, `type: "delta"`, `type: "step"`).
- **Build-Time Linting:** ESLint is explicitly ignored during the `next build` process (`ignoreDuringBuilds: true` in `next.config.ts`) to prioritize fast delivery and unblocked CI pipelines. Code quality is primarily gated by strict TypeScript checking (`npm run typecheck`).
- **Client-Side AI Configuration:** Ensure any initialization of the OpenAI client or reading of sensitive environment variables happens safely on the server side or inside specific route handlers to avoid build-time errors or leaking secrets to the client.