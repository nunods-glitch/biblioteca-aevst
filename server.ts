import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient, type Client } from "@libsql/client";
import multer from "multer";
import * as xlsx from "xlsx";
import path from "path";
import fs from "fs";
import { ZipArchive } from "archiver";
import dotenv from "dotenv";

dotenv.config();

// Connect to Turso Cloud if credentials exist, otherwise fallback to local SQLite file
const rawUrl = process.env.TURSO_DATABASE_URL?.trim();
const rawToken = process.env.TURSO_AUTH_TOKEN?.trim();

const isTursoConfigured = Boolean(
  rawUrl &&
  (rawUrl.startsWith("libsql://") || rawUrl.startsWith("https://")) &&
  !rawUrl.includes("seu-utilizador") &&
  !rawUrl.includes("sua-base-de-dados") &&
  rawToken &&
  rawToken.length > 20
);

const dbUrl = isTursoConfigured ? rawUrl! : "file:library.db";
const authToken = isTursoConfigured ? rawToken : undefined;

console.log(`[Database] Modo: ${isTursoConfigured ? "Turso Cloud (" + rawUrl + ")" : "Ficheiro SQLite local (library.db)"}`);

export const client: Client = createClient({
  url: dbUrl,
  authToken: authToken,
});

export const LIBRARIES = [
  "Biblioteca Escola Sede",
  "Biblioteca Escola de Mosteiro",
  "Biblioteca Escola Bela Vista",
  "Biblioteca Escola de Vinha"
] as const;

export type LibraryName = typeof LIBRARIES[number];

// Default spaces and activities per library
const defaultSpacesByLibrary: Record<string, { area: string; activity: string }[]> = {
  "Biblioteca Escola Sede": [
    { area: "Multimédia", activity: "Consola" },
    { area: "Multimédia", activity: "Mesa digital" },
    { area: "Multimédia", activity: "Leitor MP3" },
    { area: "Multimédia", activity: "Televisão" },
    { area: "Multimédia", activity: "Visionamento de filmes" },
    { area: "Área de leitura", activity: "Livros Portugueses" },
    { area: "Área de leitura", activity: "Livros estrangeiros" },
    { area: "Área de leitura", activity: "Enciclopédias" },
    { area: "Área de jogos", activity: "Xadrez" },
    { area: "Área de jogos", activity: "Damas" },
    { area: "Área de Estudo", activity: "Português" },
    { area: "Área de Estudo", activity: "Matemática" },
    { area: "Área de Estudo", activity: "Inglês" },
    { area: "Área de Estudo", activity: "Francês" },
    { area: "Área de Estudo", activity: "História" },
    { area: "Área de Estudo", activity: "Físico-química" },
    { area: "Área de Estudo", activity: "TIC" },
    { area: "Área de Estudo", activity: "Ciências Naturais" }
  ],
  "Biblioteca Escola de Mosteiro": [
    { area: "Área de Leitura", activity: "Livros de Leitura Autónoma" },
    { area: "Área de Leitura", activity: "Banda Desenhada" },
    { area: "Área de Leitura", activity: "Periódicos e Revistas" },
    { area: "Área de Estudo", activity: "Trabalhos de Grupo" },
    { area: "Área de Estudo", activity: "Estudo Individual" },
    { area: "Área de Estudo", activity: "Apoio Pedagógico" },
    { area: "Área Multimédia", activity: "Computadores / Pesquisa Web" },
    { area: "Área Multimédia", activity: "Jogos Educativos" },
    { area: "Área Lúdica", activity: "Jogos de Tabuleiro" },
    { area: "Área Lúdica", activity: "Xadrez e Damas" }
  ],
  "Biblioteca Escola Bela Vista": [
    { area: "Área de Leitura", activity: "Hora do Conto" },
    { area: "Área de Leitura", activity: "Leitura Recreativa" },
    { area: "Área de Leitura", activity: "Poesia e Teatro" },
    { area: "Área de Estudo", activity: "Pesquisa Escolar" },
    { area: "Área de Estudo", activity: "TPC e Estudo" },
    { area: "Área de Estudo", activity: "Trabalhos de Projeto" },
    { area: "Área Multimédia", activity: "Pesquisa Digital" },
    { area: "Área Multimédia", activity: "Audiovisuais" },
    { area: "Área de Expressão", activity: "Jogos Didáticos" },
    { area: "Área de Expressão", activity: "Desenho e Pintura" }
  ],
  "Biblioteca Escola de Vinha": [
    { area: "Área de Leitura", activity: "Requisição e Leitura" },
    { area: "Área de Leitura", activity: "Novidades Literárias" },
    { area: "Área de Estudo", activity: "Estudo Acompanhado" },
    { area: "Área de Estudo", activity: "Consulta Documental" },
    { area: "Informática e Multimédia", activity: "Computadores" },
    { area: "Informática e Multimédia", activity: "Internet Escolar" },
    { area: "Espaço Lúdico", activity: "Xadrez e Damas" },
    { area: "Espaço Lúdico", activity: "Jogos de Estratégia" }
  ]
};

// Initialize tables, migrations, and seed data
async function initDb() {
  try {
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS students (
        process_number INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        gender TEXT NOT NULL,
        class_number INTEGER,
        grade INTEGER,
        class TEXT
      );

      CREATE TABLE IF NOT EXISTS usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        process_number INTEGER,
        library TEXT NOT NULL DEFAULT 'Biblioteca Escola Sede',
        area TEXT,
        activity TEXT,
        entry_time TEXT,
        exit_time TEXT,
        date TEXT,
        FOREIGN KEY (process_number) REFERENCES students(process_number)
      );

      CREATE TABLE IF NOT EXISTS library_spaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library TEXT NOT NULL DEFAULT 'Biblioteca Escola Sede',
        area TEXT NOT NULL,
        activity TEXT NOT NULL
      );
    `);

    // Migration: check if library column exists on library_spaces
    try {
      const spacesCols = await client.execute("PRAGMA table_info(library_spaces)");
      const hasSpaceLib = spacesCols.rows.some((r: any) => r.name === "library");
      if (!hasSpaceLib) {
        await client.execute("ALTER TABLE library_spaces ADD COLUMN library TEXT NOT NULL DEFAULT 'Biblioteca Escola Sede'");
      }
    } catch (e) {
      // Ignored
    }

    // Migration: check if library column exists on usage_logs
    try {
      const logsCols = await client.execute("PRAGMA table_info(usage_logs)");
      const hasLogLib = logsCols.rows.some((r: any) => r.name === "library");
      if (!hasLogLib) {
        await client.execute("ALTER TABLE usage_logs ADD COLUMN library TEXT NOT NULL DEFAULT 'Biblioteca Escola Sede'");
      }
    } catch (e) {
      // Ignored
    }

    // Migration: update existing rows from old names to new names
    try {
      await client.executeMultiple(`
        UPDATE usage_logs SET library = 'Biblioteca Escola Sede' WHERE library = 'Escola sede';
        UPDATE usage_logs SET library = 'Biblioteca Escola de Mosteiro' WHERE library = 'Escola de Mosteiro';
        UPDATE usage_logs SET library = 'Biblioteca Escola Bela Vista' WHERE library = 'Biblioteca de Bela Vista';
        UPDATE usage_logs SET library = 'Biblioteca Escola de Vinha' WHERE library = 'Biblioteca de Vinha';

        UPDATE library_spaces SET library = 'Biblioteca Escola Sede' WHERE library = 'Escola sede';
        UPDATE library_spaces SET library = 'Biblioteca Escola de Mosteiro' WHERE library = 'Escola de Mosteiro';
        UPDATE library_spaces SET library = 'Biblioteca Escola Bela Vista' WHERE library = 'Biblioteca de Bela Vista';
        UPDATE library_spaces SET library = 'Biblioteca Escola de Vinha' WHERE library = 'Biblioteca de Vinha';
      `);
    } catch (e) {
      // Ignored
    }

    // Seed spaces for each library if missing
    for (const lib of LIBRARIES) {
      const spaces = defaultSpacesByLibrary[lib] || [];
      for (const s of spaces) {
        await client.execute({
          sql: `
            INSERT INTO library_spaces (library, area, activity)
            SELECT ?, ?, ?
            WHERE NOT EXISTS (
              SELECT 1 FROM library_spaces 
              WHERE library = ? AND LOWER(area) = LOWER(?) AND LOWER(activity) = LOWER(?)
            )
          `,
          args: [lib, s.area, s.activity, lib, s.area, s.activity]
        });
      }
    }

    // Seed sample students if table is empty
    const studentCountRes = await client.execute("SELECT COUNT(*) as count FROM students");
    const studentCount = Number(studentCountRes.rows[0]?.count || 0);
    if (studentCount === 0) {
      const sampleStudents = [
        { process_number: 12345, name: "Maria Silva Santos", gender: "Feminino", class_number: 15, grade: 8, class: "B" },
        { process_number: 10001, name: "João Pedro Ferreira", gender: "Masculino", class_number: 12, grade: 7, class: "A" },
        { process_number: 10002, name: "Ana Beatriz Costa", gender: "Feminino", class_number: 4, grade: 9, class: "C" },
        { process_number: 10003, name: "Tiago Miguel Oliveira", gender: "Masculino", class_number: 22, grade: 10, class: "A" }
      ];
      for (const s of sampleStudents) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO students (process_number, name, gender, class_number, grade, class) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [s.process_number, s.name, s.gender, s.class_number, s.grade, s.class]
        });
      }
    }

    // Seed sample usage logs if table is empty
    const usageCountRes = await client.execute("SELECT COUNT(*) as count FROM usage_logs");
    const usageCount = Number(usageCountRes.rows[0]?.count || 0);
    if (usageCount === 0) {
      const today = new Date().toISOString().split("T")[0];
      const sampleLogs = [
        { process_number: 12345, area: "Multimédia", activity: "Consola", entry_time: "10:15", exit_time: "", date: today, library: "Biblioteca Escola Sede" },
        { process_number: 10001, area: "Área de leitura", activity: "Livros Portugueses", entry_time: "10:30", exit_time: "", date: today, library: "Biblioteca Escola Sede" },
        { process_number: 10002, area: "Área de Estudo", activity: "Matemática", entry_time: "11:00", exit_time: "", date: today, library: "Biblioteca Escola Sede" },
        { process_number: 10003, area: "Área de jogos", activity: "Xadrez", entry_time: "09:45", exit_time: "10:30", date: today, library: "Biblioteca Escola Sede" }
      ];
      for (const l of sampleLogs) {
        await client.execute({
          sql: `INSERT INTO usage_logs (process_number, library, area, activity, entry_time, exit_time, date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [l.process_number, l.library, l.area, l.activity, l.entry_time, l.exit_time, l.date]
        });
      }
    }
    console.log("[Database] Inicialização da base de dados concluída com sucesso.");
  } catch (error) {
    console.error("[Database] Erro na inicialização da base de dados:", error);
  }
}

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// API Routes
app.get("/api/libraries", (req, res) => {
  res.json(LIBRARIES);
});

app.get("/api/usage", async (req, res) => {
  const library = (req.query.library as string) || "";
  try {
    let sql = `
      SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
      FROM usage_logs l
      LEFT JOIN students s ON l.process_number = s.process_number
    `;
    const args: any[] = [];
    if (library && library !== "all") {
      sql += ` WHERE l.library = ? `;
      args.push(library);
    }
    sql += ` ORDER BY l.date DESC, l.id DESC`;

    const result = await client.execute({ sql, args });
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch usage logs" });
  }
});

app.put("/api/usage/:id", async (req, res) => {
  const { area, activity, exit_time } = req.body;
  const { id } = req.params;
  try {
    const curRes = await client.execute({
      sql: "SELECT * FROM usage_logs WHERE id = ?",
      args: [id]
    });
    const current = curRes.rows[0] as any;
    if (!current) {
      return res.status(404).json({ error: "Registo não encontrado" });
    }

    const updatedArea = area !== undefined ? area : current.area;
    const updatedActivity = activity !== undefined ? activity : current.activity;
    const updatedExitTime = exit_time !== undefined ? exit_time : current.exit_time;

    await client.execute({
      sql: `UPDATE usage_logs SET area = ?, activity = ?, exit_time = ? WHERE id = ?`,
      args: [updatedArea, updatedActivity, updatedExitTime, id]
    });

    const updatedRes = await client.execute({
      sql: `
        SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
        FROM usage_logs l
        LEFT JOIN students s ON l.process_number = s.process_number
        WHERE l.id = ?
      `,
      args: [id]
    });

    res.json({ success: true, log: updatedRes.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar registo" });
  }
});

// Real-time Occupancy API
app.get("/api/occupancy", async (req, res) => {
  try {
    const library = (req.query.library as string) || "Biblioteca Escola Sede";
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    // Active logs for the library today
    const activeRes = await client.execute({
      sql: `
        SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
        FROM usage_logs l
        LEFT JOIN students s ON l.process_number = s.process_number
        WHERE l.date = ? AND l.library = ? AND (l.exit_time IS NULL OR l.exit_time = '')
        ORDER BY l.entry_time DESC
      `,
      args: [today, library]
    });

    // All logs for the library today
    const allTodayRes = await client.execute({
      sql: `
        SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
        FROM usage_logs l
        LEFT JOIN students s ON l.process_number = s.process_number
        WHERE l.date = ? AND l.library = ?
        ORDER BY l.entry_time DESC
      `,
      args: [today, library]
    });

    // Spaces for this library
    const spacesRes = await client.execute({
      sql: "SELECT * FROM library_spaces WHERE library = ? ORDER BY area, activity",
      args: [library]
    });

    res.json({
      date: today,
      currentTime,
      library,
      libraries: LIBRARIES,
      activeLogs: activeRes.rows,
      allTodayLogs: allTodayRes.rows,
      spaces: spacesRes.rows,
      todayTotalCount: allTodayRes.rows.length,
      activeCount: activeRes.rows.length
    });
  } catch (error) {
    console.error("Error in /api/occupancy:", error);
    res.status(500).json({ error: "Failed to fetch occupancy data" });
  }
});

// Quick checkout / record exit time
app.post("/api/usage/:id/checkout", async (req, res) => {
  const { id } = req.params;
  const now = new Date();
  const exitTime = req.body.exit_time || now.toTimeString().slice(0, 5);
  try {
    await client.execute({
      sql: `UPDATE usage_logs SET exit_time = ? WHERE id = ?`,
      args: [exitTime, id]
    });

    const updatedRes = await client.execute({
      sql: `
        SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
        FROM usage_logs l
        LEFT JOIN students s ON l.process_number = s.process_number
        WHERE l.id = ?
      `,
      args: [id]
    });

    res.json({ success: true, log: updatedRes.rows[0], exit_time: exitTime });
  } catch (error) {
    console.error("Error in checkout:", error);
    res.status(500).json({ error: "Erro ao registar saída" });
  }
});

// Bulk checkout: set exit time for multiple active logs simultaneously (requires password "escola")
app.post("/api/usage/bulk-checkout", async (req, res) => {
  const { ids, exit_time, password } = req.body;

  if (password !== "escola") {
    return res.status(403).json({ error: "Palavra-passe incorreta. Apenas administradores autorizados podem registar saídas em massa." });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Nenhum registo selecionado para saída" });
  }

  const now = new Date();
  const exitTime = exit_time || now.toTimeString().slice(0, 5);

  try {
    const stmts = ids.map(id => ({
      sql: "UPDATE usage_logs SET exit_time = ? WHERE id = ? AND (exit_time IS NULL OR exit_time = '')",
      args: [exitTime, id]
    }));

    await client.batch(stmts, "write");

    // Fetch the updated logs
    const placeholders = ids.map(() => "?").join(",");
    const updatedRes = await client.execute({
      sql: `
        SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
        FROM usage_logs l
        LEFT JOIN students s ON l.process_number = s.process_number
        WHERE l.id IN (${placeholders})
      `,
      args: ids
    });

    res.json({
      success: true,
      count: ids.length,
      exit_time: exitTime,
      logs: updatedRes.rows
    });
  } catch (error) {
    console.error("Error in bulk checkout:", error);
    res.status(500).json({ error: "Erro ao registar saídas em massa" });
  }
});

// Bulk delete: permanently delete multiple usage logs (requires password "escola")
app.post("/api/usage/bulk-delete", async (req, res) => {
  const { ids, password } = req.body;

  if (password !== "escola") {
    return res.status(403).json({ error: "Palavra-passe incorreta. Apenas administradores autorizados podem eliminar registos." });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Nenhum registo selecionado para eliminar" });
  }

  try {
    const stmts = ids.map(id => ({
      sql: "DELETE FROM usage_logs WHERE id = ?",
      args: [id]
    }));

    await client.batch(stmts, "write");
    res.json({ success: true, count: ids.length });
  } catch (error) {
    console.error("Error in bulk delete:", error);
    res.status(500).json({ error: "Erro ao eliminar registos de utilização" });
  }
});

// Single delete: permanently delete a single usage log (requires password "escola")
app.post("/api/usage/:id/delete", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (password !== "escola") {
    return res.status(403).json({ error: "Palavra-passe incorreta. Apenas administradores autorizados podem eliminar registos." });
  }

  try {
    const result = await client.execute({
      sql: "DELETE FROM usage_logs WHERE id = ?",
      args: [id]
    });
    if (result.rowsAffected > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Registo não encontrado" });
    }
  } catch (error) {
    console.error("Error in single delete:", error);
    res.status(500).json({ error: "Erro ao eliminar registo" });
  }
});

app.get("/api/students/:id", async (req, res) => {
  try {
    const result = await client.execute({
      sql: "SELECT * FROM students WHERE process_number = ?",
      args: [req.params.id]
    });
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: "Student not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao procurar aluno" });
  }
});

app.post("/api/usage", async (req, res) => {
  const { process_number, library, area, activity, entry_time, exit_time, date } = req.body;
  const lib = library || "Biblioteca Escola Sede";
  try {
    const result = await client.execute({
      sql: `
        INSERT INTO usage_logs (process_number, library, area, activity, entry_time, exit_time, date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [process_number, lib, area, activity, entry_time, exit_time, date]
    });
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to register usage" });
  }
});

app.get("/api/analysis", async (req, res) => {
  const startDate = (req.query.startDate as string) || "1970-01-01";
  const endDate = (req.query.endDate as string) || "2099-12-31";
  const library = (req.query.library as string) || "";
  
  try {
    let sql = `
      SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
      FROM usage_logs l
      LEFT JOIN students s ON l.process_number = s.process_number
      WHERE l.date BETWEEN ? AND ?
    `;
    const args: any[] = [startDate, endDate];
    if (library && library !== "all") {
      sql += ` AND l.library = ? `;
      args.push(library);
    }
    sql += ` ORDER BY l.date DESC, l.id DESC`;

    const result = await client.execute({ sql, args });
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao obter registos para análise" });
  }
});

app.get("/api/spaces", async (req, res) => {
  const library = (req.query.library as string) || "";
  try {
    if (library && library !== "all") {
      const result = await client.execute({
        sql: "SELECT * FROM library_spaces WHERE library = ? ORDER BY area, activity",
        args: [library]
      });
      res.json(result.rows);
    } else {
      const result = await client.execute("SELECT * FROM library_spaces ORDER BY library, area, activity");
      res.json(result.rows);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao obter espaços" });
  }
});

app.post("/api/spaces", async (req, res) => {
  const { library, area, activity } = req.body;
  if (!area || !activity) {
    return res.status(400).json({ error: "Área e Atividade são obrigatórias" });
  }
  const lib = library || "Biblioteca Escola Sede";
  try {
    const existsRes = await client.execute({
      sql: `
        SELECT id FROM library_spaces 
        WHERE library = ? AND LOWER(area) = LOWER(?) AND LOWER(activity) = LOWER(?)
      `,
      args: [lib, area, activity]
    });

    if (existsRes.rows.length > 0) {
      return res.status(400).json({ error: "Este espaço/atividade já existe nesta biblioteca" });
    }

    const info = await client.execute({
      sql: `INSERT INTO library_spaces (library, area, activity) VALUES (?, ?, ?)`,
      args: [lib, area.trim(), activity.trim()]
    });

    res.json({ success: true, id: Number(info.lastInsertRowid) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao adicionar espaço" });
  }
});

app.delete("/api/spaces/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await client.execute({
      sql: "DELETE FROM library_spaces WHERE id = ?",
      args: [id]
    });
    if (result.rowsAffected > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Espaço não encontrado" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover espaço" });
  }
});

app.post("/api/spaces/reset", async (req, res) => {
  const { library } = req.body;
  try {
    const targetLibs = library && library !== "all" ? [library] : LIBRARIES;
    const stmts: { sql: string; args: any[] }[] = [];

    for (const lib of targetLibs) {
      stmts.push({
        sql: "DELETE FROM library_spaces WHERE library = ?",
        args: [lib]
      });
      const defaults = defaultSpacesByLibrary[lib] || [];
      for (const item of defaults) {
        stmts.push({
          sql: "INSERT INTO library_spaces (library, area, activity) VALUES (?, ?, ?)",
          args: [lib, item.area, item.activity]
        });
      }
    }

    await client.batch(stmts, "write");
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao repor espaços padrão" });
  }
});

// Download sample template for students
app.get("/api/template/students", (req, res) => {
  const sampleData = [
    { Processo: 12345, Nome: "Exemplo Aluno 1", Genero: "Feminino", Numero: 15, Ano: 8, Turma: "B" },
    { Processo: 12346, Nome: "Exemplo Aluno 2", Genero: "Masculino", Numero: 10, Ano: 7, Turma: "A" }
  ];
  const ws = xlsx.utils.json_to_sheet(sampleData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Alunos");
  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", "attachment; filename=modelo_alunos.xlsx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

// Download sample template for usage in Excel (.xlsx)
app.get("/api/template/usage-excel", (req, res) => {
  const sampleData = [
    { 
      Data: "2026-09-15", 
      Processo: 12345, 
      Biblioteca: "Biblioteca Escola Sede",
      Area: "Multimédia", 
      Atividade: "Consola", 
      "Hora Entrada": "10:15", 
      "Hora Saida": "11:00", 
      Nome: "Maria Silva Santos", 
      Ano: 8, 
      Turma: "B" 
    },
    { 
      Data: "2026-09-15", 
      Processo: 10001, 
      Biblioteca: "Biblioteca Escola de Mosteiro",
      Area: "Área de Leitura", 
      Atividade: "Livros de Leitura Autónoma", 
      "Hora Entrada": "10:30", 
      "Hora Saida": "11:15", 
      Nome: "João Pedro Ferreira", 
      Ano: 7, 
      Turma: "A" 
    },
    { 
      Data: "2026-09-16", 
      Processo: 10002, 
      Biblioteca: "Biblioteca Escola Bela Vista",
      Area: "Área de Leitura", 
      Atividade: "Hora do Conto", 
      "Hora Entrada": "14:00", 
      "Hora Saida": "14:45", 
      Nome: "Ana Beatriz Costa", 
      Ano: 9, 
      Turma: "C" 
    },
    { 
      Data: "2026-09-16", 
      Processo: 10003, 
      Biblioteca: "Biblioteca Escola de Vinha",
      Area: "Espaço Lúdico", 
      Atividade: "Xadrez e Damas", 
      "Hora Entrada": "15:10", 
      "Hora Saida": "15:55", 
      Nome: "Tiago Miguel Oliveira", 
      Ano: 10, 
      Turma: "A" 
    }
  ];
  const ws = xlsx.utils.json_to_sheet(sampleData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Registos");
  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", "attachment; filename=modelo_registos_historicos.xlsx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

// Download sample template for usage CSV
app.get("/api/template/usage-csv", (req, res) => {
  const sampleCsv = "\uFEFFData;Processo;Biblioteca;Área;Atividade;Hora Entrada;Hora Saída;Nome;Ano;Turma\r\n" +
    "2026-09-15;12345;Biblioteca Escola Sede;Multimédia;Consola;10:15;11:00;Maria Silva Santos;8;B\r\n" +
    "2026-09-15;10001;Biblioteca Escola de Mosteiro;Área de Leitura;Livros de Leitura Autónoma;10:30;11:15;João Pedro Ferreira;7;A\r\n" +
    "2026-09-16;10002;Biblioteca Escola Bela Vista;Área de Leitura;Hora do Conto;14:00;14:45;Ana Beatriz Costa;9;C\r\n" +
    "2026-09-16;10003;Biblioteca Escola de Vinha;Espaço Lúdico;Xadrez e Damas;15:10;15:55;Tiago Miguel Oliveira;10;A\r\n";

  res.setHeader("Content-Disposition", "attachment; filename=modelo_registos_historicos.csv");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.send(Buffer.from(sampleCsv, "utf-8"));
});

// Download sample template for spaces
app.get("/api/template/spaces", (req, res) => {
  const sampleData = [
    { Biblioteca: "Biblioteca Escola Sede", Area: "Multimédia", Atividade: "Consola" },
    { Biblioteca: "Biblioteca Escola Sede", Area: "Área de leitura", Atividade: "Livros Portugueses" },
    { Biblioteca: "Biblioteca Escola de Mosteiro", Area: "Área de Leitura", Atividade: "Livros de Leitura Autónoma" },
    { Biblioteca: "Biblioteca Escola Bela Vista", Area: "Área de Leitura", Atividade: "Hora do Conto" },
    { Biblioteca: "Biblioteca Escola de Vinha", Area: "Informática e Multimédia", Atividade: "Computadores" }
  ];
  const ws = xlsx.utils.json_to_sheet(sampleData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Espacos");
  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", "attachment; filename=modelo_espacos.xlsx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

app.post("/api/upload-spaces", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet) as any[];

    if (!data || data.length === 0) {
      return res.status(400).json({ error: "O ficheiro Excel está vazio ou inválido." });
    }

    const defaultLib = (req.body.library as string) || "";
    const stmts: { sql: string; args: any[] }[] = [];

    // If a specific library was specified in request body, only replace spaces for that library
    if (defaultLib && defaultLib !== "all") {
      stmts.push({
        sql: "DELETE FROM library_spaces WHERE library = ?",
        args: [defaultLib]
      });
    } else {
      const libsInFile = new Set<string>();
      for (const s of data) {
        const lib = s.Biblioteca || s.biblioteca || s.Escola || s.escola || defaultLib || "Biblioteca Escola Sede";
        libsInFile.add(lib);
      }
      for (const lib of libsInFile) {
        stmts.push({
          sql: "DELETE FROM library_spaces WHERE library = ?",
          args: [lib]
        });
      }
    }

    for (const s of data) {
      const lib = s.Biblioteca || s.biblioteca || s.Escola || s.escola || defaultLib || "Biblioteca Escola Sede";
      const area = s.Area || s.area || s.Área || s["Área"];
      const activity = s.Atividade || s.atividade || s.Activity || s.activity;
      if (area && activity) {
        stmts.push({
          sql: "INSERT INTO library_spaces (library, area, activity) VALUES (?, ?, ?)",
          args: [String(lib).trim(), String(area).trim(), String(activity).trim()]
        });
      }
    }

    await client.batch(stmts, "write");
    const countRes = await client.execute("SELECT COUNT(*) as count FROM library_spaces");
    res.json({ success: true, count: Number(countRes.rows[0]?.count || 0) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao processar ficheiro Excel de espaços" });
  }
});

app.post("/api/upload-students", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet) as any[];

    if (!data || data.length === 0) {
      return res.status(400).json({ error: "O ficheiro Excel está vazio ou sem registos." });
    }

    const stmts: { sql: string; args: any[] }[] = [];
    for (const s of data) {
      const proc = s.Processo || s.process_number || s["N.º Processo"] || s["Nº Processo"] || s["Processo Nº"];
      const name = s.Nome || s.name || s["Nome Completo"] || s["Nome do Aluno"];
      const gender = s.Genero || s.gender || s.Género || s["Sexo"] || "Outro";
      const classNum = s.Numero || s.class_number || s.Número || s["Nº"] || s["N.º"] || null;
      const grade = s.Ano || s.grade || s["Ano de Escolaridade"] || null;
      const className = s.Turma || s.class || s["Turma "] || "";

      if (proc && name) {
        stmts.push({
          sql: "INSERT OR REPLACE INTO students (process_number, name, gender, class_number, grade, class) VALUES (?, ?, ?, ?, ?, ?)",
          args: [Number(proc), String(name).trim(), String(gender).trim(), classNum ? Number(classNum) : null, grade ? Number(grade) : null, String(className).trim()]
        });
      }
    }

    // Execute in chunks to respect batch size limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < stmts.length; i += CHUNK_SIZE) {
      const chunk = stmts.slice(i, i + CHUNK_SIZE);
      await client.batch(chunk, "write");
    }

    res.json({ success: true, count: stmts.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao processar ficheiro Excel de alunos" });
  }
});

// CSV parser helper for fallback historical usage logs
function parseCsvBuffer(buffer: Buffer): Record<string, string>[] {
  let text = buffer.toString("utf-8");
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  let delimiter = ",";
  if (headerLine.includes(";") && (!headerLine.includes(",") || (headerLine.match(/;/g) || []).length >= (headerLine.match(/,/g) || []).length)) {
    delimiter = ";";
  } else if (headerLine.includes("\t")) {
    delimiter = "\t";
  }

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(headerLine).map(h => h.replace(/^["'\uFEFF]|["']$/g, "").trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0] === "")) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx].replace(/^["']|["']$/g, "").trim() : "";
    });
    rows.push(row);
  }
  return rows;
}

function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  const str = raw.trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const [y, m, d] = str.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const euMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (euMatch) {
    const [, d, m, y] = euMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const ymdMatch = str.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return str;
}

function parseExcelDate(val: any): string {
  if (!val) return new Date().toISOString().split("T")[0];
  if (typeof val === "number") {
    // Excel serial date number
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split("T")[0];
  }
  return normalizeDate(String(val));
}

function normalizeTime(raw: string): string {
  if (!raw) return "";
  const str = raw.trim();
  const match = str.match(/^(\d{1,2}):(\d{1,2})/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
  }
  return str;
}

function parseExcelTime(val: any): string {
  if (val === undefined || val === null || val === "") return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    const hours = String(val.getHours()).padStart(2, "0");
    const minutes = String(val.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  if (typeof val === "number" && val >= 0 && val < 1) {
    const totalSeconds = Math.round(val * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return normalizeTime(String(val));
}

// Upload historical usage logs (Supports Excel .xlsx, .xls and CSV)
const handleUsageUpload = async (req: express.Request, res: express.Response) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum ficheiro foi carregado" });

  try {
    let rows: Record<string, any>[] = [];

    // Attempt to parse as Excel first (xlsx/xls/csv)
    try {
      const workbook = xlsx.read(req.file.buffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (sheetName) {
        const sheet = workbook.Sheets[sheetName];
        rows = xlsx.utils.sheet_to_json(sheet) as Record<string, any>[];
      }
    } catch (e) {
      // Fallback to custom CSV parser
      rows = parseCsvBuffer(req.file.buffer);
    }

    if (!rows || rows.length === 0) {
      rows = parseCsvBuffer(req.file.buffer);
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: "O ficheiro está vazio ou em formato inválido." });
    }

    const targetDefaultLibrary = (req.body.library as string) || "Biblioteca Escola Sede";

    let insertedCount = 0;
    let skippedCount = 0;

    const stmts: { sql: string; args: any[] }[] = [];

    // Preload existing logs and students to avoid massive N+1 queries over remote Turso
    const existingLogsRes = await client.execute("SELECT process_number, date, entry_time, library, area FROM usage_logs");
    const existingLogKeys = new Set(
      existingLogsRes.rows.map(
        (r: any) => `${r.process_number}_${r.date}_${r.entry_time}_${r.library}_${r.area}`
      )
    );

    const existingStudentsRes = await client.execute("SELECT process_number FROM students");
    const existingStudentSet = new Set(existingStudentsRes.rows.map((r: any) => Number(r.process_number)));

    for (const r of rows) {
      const findVal = (possibleKeys: string[]): any => {
        for (const key of Object.keys(r)) {
          const cleanKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          for (const pk of possibleKeys) {
            const cleanPk = pk.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (cleanKey === cleanPk) return r[key];
          }
        }
        return "";
      };

      const procRaw = findVal(["processo", "process_number", "nº processo", "n.º processo", "proc", "numero"]);
      const procStr = String(procRaw || "");
      const proc = parseInt(procStr.replace(/\D/g, ""), 10);
      if (isNaN(proc) || proc <= 0) {
        skippedCount++;
        continue;
      }

      const dateRaw = findVal(["data", "date", "dia", "data de utilizacao"]);
      const date = parseExcelDate(dateRaw);

      // Match Library
      const libRaw = String(findVal(["biblioteca", "escola", "polo", "unidade", "library"]) || "").trim();
      let matchedLib = targetDefaultLibrary;
      if (libRaw) {
        const clean = libRaw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (clean.includes("mosteiro")) matchedLib = "Biblioteca Escola de Mosteiro";
        else if (clean.includes("bela") || clean.includes("vista")) matchedLib = "Biblioteca Escola Bela Vista";
        else if (clean.includes("vinha")) matchedLib = "Biblioteca Escola de Vinha";
        else if (clean.includes("sede") || clean.includes("torcato")) matchedLib = "Biblioteca Escola Sede";
        else matchedLib = libRaw;
      }

      const area = String(findVal(["area", "espaco", "area a frequentar", "local"]) || "Área de Leitura").trim();
      const activity = String(findVal(["atividade", "activity", "acao", "tarefa"]) || "Leitura / Estudo").trim();

      const entryTimeRaw = findVal(["hora entrada", "hora de entrada", "entrada", "entry_time", "inicio", "hora inicio"]);
      const entryTime = parseExcelTime(entryTimeRaw) || "09:00";

      const exitTimeRaw = findVal(["hora saida", "hora de saida", "saida", "exit_time", "fim", "hora fim"]);
      const exitTime = parseExcelTime(exitTimeRaw);

      // Optional student metadata
      const studentName = String(findVal(["nome", "nome do aluno", "aluno", "nome completo"]) || "").trim();
      const studentGender = String(findVal(["genero", "sexo"]) || "Outro").trim();
      const studentGrade = parseInt(String(findVal(["ano", "ano de escolaridade", "grade"]) || ""), 10) || null;
      const studentClass = String(findVal(["turma", "class"]) || "").trim();

      if (studentName) {
        stmts.push({
          sql: "INSERT OR REPLACE INTO students (process_number, name, gender, class_number, grade, class) VALUES (?, ?, ?, ?, ?, ?)",
          args: [proc, studentName, studentGender, null, studentGrade, studentClass]
        });
        existingStudentSet.add(proc);
      } else if (!existingStudentSet.has(proc)) {
        stmts.push({
          sql: "INSERT OR IGNORE INTO students (process_number, name, gender, class_number, grade, class) VALUES (?, ?, ?, ?, ?, ?)",
          args: [proc, `Aluno ${proc}`, "Outro", null, null, ""]
        });
        existingStudentSet.add(proc);
      }

      // Avoid duplicate log record
      const key = `${proc}_${date}_${entryTime}_${matchedLib}_${area}`;
      if (existingLogKeys.has(key)) {
        skippedCount++;
        continue;
      }
      existingLogKeys.add(key);

      stmts.push({
        sql: "INSERT INTO usage_logs (process_number, library, area, activity, entry_time, exit_time, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [proc, matchedLib, area, activity, entryTime, exitTime, date]
      });

      stmts.push({
        sql: `
          INSERT INTO library_spaces (library, area, activity)
          SELECT ?, ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM library_spaces 
            WHERE library = ? AND LOWER(area) = LOWER(?) AND LOWER(activity) = LOWER(?)
          )
        `,
        args: [matchedLib, area, activity, matchedLib, area, activity]
      });

      insertedCount++;
    }

    // Execute in batches of 100 for optimal network performance with Turso
    const BATCH_SIZE = 100;
    for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
      const chunk = stmts.slice(i, i + BATCH_SIZE);
      await client.batch(chunk, "write");
    }

    res.json({
      success: true,
      count: insertedCount,
      skipped: skippedCount,
      total: rows.length
    });
  } catch (error) {
    console.error("Error in upload-usage:", error);
    res.status(500).json({ error: "Erro ao processar ficheiro de registos históricos" });
  }
};

app.post("/api/upload-usage", upload.single("file"), handleUsageUpload);
app.post("/api/upload-usage-csv", upload.single("file"), handleUsageUpload);

// Download full project ZIP
app.get("/api/download-zip", (req, res) => {
  const password = req.query.password as string;
  if (password !== "escola") {
    return res.status(403).json({ error: "Palavra-passe incorreta" });
  }

  const rootDir = process.cwd();
  res.setHeader("Content-Disposition", "attachment; filename=biblioteca-aevst.zip");
  res.setHeader("Content-Type", "application/zip");

  const archive = new ZipArchive({
    zlib: { level: 9 }
  });

  archive.on("error", (err) => {
    console.error("Archive error:", err);
    res.status(500).send({ error: err.message });
  });

  archive.pipe(res);

  // Include root project files
  const rootFiles = [
    "package.json",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.ts",
    "server.ts",
    "index.html",
    "metadata.json",
    ".gitignore",
    ".env.example",
    "README.md",
    "render.yaml"
  ];

  for (const file of rootFiles) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
      archive.file(fullPath, { name: file });
    }
  }

  // Include src directory
  const srcDir = path.join(rootDir, "src");
  if (fs.existsSync(srcDir)) {
    archive.directory(srcDir, "src");
  }

  // Include public directory if exists
  const publicDir = path.join(rootDir, "public");
  if (fs.existsSync(publicDir)) {
    archive.directory(publicDir, "public");
  }

  // Generate Iniciar_Biblioteca.bat directly in the ZIP for Windows users!
  const batContent = `@echo off
title Biblioteca AEVST - Servidor Local
cd /d "%~dp0"

echo ========================================================
echo   BIBLIOTECA AEVST - Gestao de Espacos
echo ========================================================
echo A iniciar a aplicacao...
echo Por favor nao feche esta janela enquanto estiver a usar.
echo.

if not exist "node_modules" (
    echo A instalar dependencias pela primeira vez...
    call npm install
)

start "" "http://localhost:3000"
call npm run dev
pause
`;
  archive.append(batContent, { name: "Iniciar_Biblioteca.bat" });

  // Generate INSTRUCOES_WINDOWS.txt
  const readmeContent = `BIBLIOTECA AEVST - INSTRUÇÕES DE INSTALAÇÃO NO WINDOWS 11
=========================================================

1. Certifique-se de que tem o Node.js instalado no computador:
   Pode descarregar gratuitamente em: https://nodejs.org (versão LTS recomendada).

2. Extraia todos os ficheiros deste ZIP para uma pasta no seu computador
   (exemplo: C:\\Biblioteca-AEVST ou na pasta Documentos).

3. Na pasta extraída, dê um duplo clique no ficheiro:
   "Iniciar_Biblioteca.bat"

   - Na primeira vez, o programa irá instalar os componentes necessários automaticamente.
   - De seguida, o navegador abrirá automaticamente a aplicação em:
     http://localhost:3000

4. Para criar um atalho no Ambiente de Trabalho:
   - Clique com o botão direito no ficheiro "Iniciar_Biblioteca.bat"
   - Escolha "Mostrar mais opções" -> "Enviar para" -> "Ambiente de Trabalho (criar atalho)".

Pronto a utilizar de forma 100% local e segura!
`;
  archive.append(readmeContent, { name: "INSTRUCOES_WINDOWS.txt" });

  archive.finalize();
});

async function startServer() {
  await initDb();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
