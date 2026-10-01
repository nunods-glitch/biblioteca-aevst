# Biblioteca AEVST - Gestão e Monitorização de Espaços

Aplicação completa (Full-Stack com React, TypeScript, Express e SQLite) para registo de afluência, gestão de espaços em tempo real, importação de alunos (Excel) e registos históricos (CSV), relatórios formais em PDF para a Direção e análise de tendências de utilização dos últimos 30 dias.

---

## 🚀 Como Publicar Gratuitamente Online (GitHub + Render)

Esta aplicação pode ser publicada online sem qualquer custo utilizando o **GitHub** e plataformas na nuvem gratuitas como o **Render.com**, **Railway** ou **Fly.io**.

### Passo 1: Criar Repositório no GitHub
1. Aceda a [github.com](https://github.com) e crie uma conta gratuita (caso ainda não tenha).
2. Clique no botão **"New repository"** e dê um nome (por exemplo: `biblioteca-aevst`).
3. Mantenha o repositório como **Público** ou **Privado** e clique em **"Create repository"**.
4. Envie os ficheiros deste projeto para o GitHub através do terminal:
   ```bash
   git init
   git add .
   git commit -m "Publicação inicial da Biblioteca AEVST"
   git branch -M main
   git remote add origin https://github.com/SEU_UTILIZADOR/biblioteca-aevst.git
   git push -u origin main
   ```
   *(Em alternativa, pode arrastar e soltar os ficheiros diretamente no site do GitHub).*

---

### Passo 2: Hospedar Gratuitamente no Render.com
1. Aceda a [render.com](https://render.com) e inicie sessão com a sua conta GitHub.
2. No painel de controlo, clique em **"New +"** e selecione **"Web Service"**.
3. Escolha o repositório `biblioteca-aevst` que acabou de criar no GitHub.
4. Preencha as seguintes opções (a maioria é detetada automaticamente):
   - **Name**: `biblioteca-aevst`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (gratuito)
5. **Configurar Turso (Para os dados nunca se perderem quando o Render adormece):**
   - No separador **Environment** do Render, adicione:
     - `TURSO_DATABASE_URL`: o endereço `libsql://...` da sua base de dados no Turso
     - `TURSO_AUTH_TOKEN`: o token gerado no Turso
6. Clique em **"Deploy Web Service"**.
7. Em cerca de 2 minutos, a aplicação estará no ar com ligação HTTPS segura e gratuita (exemplo: `https://biblioteca-aevst.onrender.com`).

---

### Passo 3: Partilhar com a Comunidade Escolar
- Pode partilhar o link gerado com professores, alunos e funcionários da escola.
- A aplicação é totalmente responsiva e funciona em computadores, tablets e telemóveis.

---

## 💻 Executar Localmente no Computador da Escola (Windows 11)

1. Certifique-se de que tem o [Node.js](https://nodejs.org) instalado (versão LTS recomendada).
2. Extraia o ficheiro ZIP da aplicação numa pasta (ex: `C:\Biblioteca-AEVST`).
3. Dê um duplo clique no ficheiro `Iniciar_Biblioteca.bat`.
4. O navegador abrirá automaticamente em `http://localhost:3000`.

---

## 🔒 Segurança e Palavra-passe de Administração
- **Palavra-passe de Administrador**: `escola`
  - Utilizada para autorizar o registo de saídas em massa de alunos.
  - Utilizada para aceder ao download do instalador local para Windows 11.
  - Utilizada para aceder ao centro de publicação online e configuração do repositório.
