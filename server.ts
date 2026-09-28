import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import multer from "multer";
import * as xlsx from "xlsx";
import path from "path";
import fs from "fs";
import { ZipArchive } from "archiver";

const db = new Database("library.db");

// Initialize Database
db.exec(`
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
    area TEXT,
    activity TEXT,
    entry_time TEXT,
    exit_time TEXT,
    date TEXT,
    FOREIGN KEY (process_number) REFERENCES students(process_number)
  );

  CREATE TABLE IF NOT EXISTS library_spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area TEXT NOT NULL,
    activity TEXT NOT NULL
  );
`);

// Seed default spaces if table is empty
const spaceCount = (db.prepare("SELECT COUNT(*) as count FROM library_spaces").get() as { count: number }).count;
if (spaceCount === 0) {
  const defaultSpaces = [
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
  ];
  const insertSpace = db.prepare("INSERT INTO library_spaces (area, activity) VALUES (?, ?)");
  for (const s of defaultSpaces) {
    insertSpace.run(s.area, s.activity);
  }
}

// Seed sample students if table is empty
const studentCount = (db.prepare("SELECT COUNT(*) as count FROM students").get() as { count: number }).count;
if (studentCount === 0) {
  const sampleStudents = [
    { process_number: 12345, name: "Maria Silva Santos", gender: "Feminino", class_number: 15, grade: 8, class: "B" },
    { process_number: 10001, name: "João Pedro Ferreira", gender: "Masculino", class_number: 12, grade: 7, class: "A" },
    { process_number: 10002, name: "Ana Beatriz Costa", gender: "Feminino", class_number: 4, grade: 9, class: "C" },
    { process_number: 10003, name: "Tiago Miguel Oliveira", gender: "Masculino", class_number: 22, grade: 10, class: "A" }
  ];
  const insertStudent = db.prepare(`
    INSERT OR IGNORE INTO students (process_number, name, gender, class_number, grade, class)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const s of sampleStudents) {
    insertStudent.run(s.process_number, s.name, s.gender, s.class_number, s.grade, s.class);
  }
}

// Seed sample usage logs if table is empty
const usageCount = (db.prepare("SELECT COUNT(*) as count FROM usage_logs").get() as { count: number }).count;
if (usageCount === 0) {
  const today = new Date().toISOString().split("T")[0];
  const sampleLogs = [
    { process_number: 12345, area: "Multimédia", activity: "Consola", entry_time: "10:15", exit_time: "", date: today },
    { process_number: 10001, area: "Área de leitura", activity: "Livros Portugueses", entry_time: "10:30", exit_time: "", date: today },
    { process_number: 10002, area: "Área de Estudo", activity: "Matemática", entry_time: "11:00", exit_time: "", date: today },
    { process_number: 10003, area: "Área de jogos", activity: "Xadrez", entry_time: "09:45", exit_time: "10:30", date: today }
  ];
  const insertLog = db.prepare(`
    INSERT INTO usage_logs (process_number, area, activity, entry_time, exit_time, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const l of sampleLogs) {
    insertLog.run(l.process_number, l.area, l.activity, l.entry_time, l.exit_time, l.date);
  }
}

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// API Routes
app.get("/api/usage", (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
      FROM usage_logs l
      LEFT JOIN students s ON l.process_number = s.process_number
      ORDER BY l.date DESC, l.id DESC
    `).all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch usage logs" });
  }
});

app.put("/api/usage/:id", (req, res) => {
  const { area, activity, exit_time } = req.body;
  const { id } = req.params;
  try {
    const current = db.prepare("SELECT * FROM usage_logs WHERE id = ?").get(id) as any;
    if (!current) {
      return res.status(404).json({ error: "Registo não encontrado" });
    }

    const updatedArea = area !== undefined ? area : current.area;
    const updatedActivity = activity !== undefined ? activity : current.activity;
    const updatedExitTime = exit_time !== undefined ? exit_time : current.exit_time;

    db.prepare(`
      UPDATE usage_logs 
      SET area = ?, activity = ?, exit_time = ?
      WHERE id = ?
    `).run(updatedArea, updatedActivity, updatedExitTime, id);

    const updated = db.prepare(`
      SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
      FROM usage_logs l
      LEFT JOIN students s ON l.process_number = s.process_number
      WHERE l.id = ?
    `).get(id);

    res.json({ success: true, log: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar registo" });
  }
});

// Real-time Occupancy API
app.get("/api/occupancy", (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    // Active logs: today's logs where exit_time is empty or null
    const activeLogs = db.prepare(`
      SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
      FROM usage_logs l
      LEFT JOIN students s ON l.process_number = s.process_number
      WHERE l.date = ? AND (l.exit_time IS NULL OR l.exit_time = '')
      ORDER BY l.entry_time DESC
    `).all(today);

    // All logs for today
    const allTodayLogs = db.prepare(`
      SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
      FROM usage_logs l
      LEFT JOIN students s ON l.process_number = s.process_number
      WHERE l.date = ?
      ORDER BY l.entry_time DESC
    `).all(today);

    // Spaces
    const spaces = db.prepare("SELECT * FROM library_spaces").all();

    res.json({
      date: today,
      currentTime,
      activeLogs,
      allTodayLogs,
      spaces,
      todayTotalCount: allTodayLogs.length,
      activeCount: activeLogs.length
    });
  } catch (error) {
    console.error("Error in /api/occupancy:", error);
    res.status(500).json({ error: "Failed to fetch occupancy data" });
  }
});

// Quick checkout / record exit time
app.post("/api/usage/:id/checkout", (req, res) => {
  const { id } = req.params;
  const now = new Date();
  const exitTime = req.body.exit_time || now.toTimeString().slice(0, 5);
  try {
    db.prepare(`
      UPDATE usage_logs 
      SET exit_time = ?
      WHERE id = ?
    `).run(exitTime, id);

    const updated = db.prepare(`
      SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
      FROM usage_logs l
      LEFT JOIN students s ON l.process_number = s.process_number
      WHERE l.id = ?
    `).get(id);

    res.json({ success: true, log: updated, exit_time: exitTime });
  } catch (error) {
    console.error("Error in checkout:", error);
    res.status(500).json({ error: "Erro ao registar saída" });
  }
});

// Bulk checkout: set exit time for multiple active logs simultaneously (requires password "escola")
app.post("/api/usage/bulk-checkout", (req, res) => {
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
    const update = db.prepare(`
      UPDATE usage_logs 
      SET exit_time = ?
      WHERE id = ? AND (exit_time IS NULL OR exit_time = '')
    `);

    const updateMany = db.transaction((logIds: number[]) => {
      let count = 0;
      for (const id of logIds) {
        const result = update.run(exitTime, id);
        count += result.changes;
      }
      return count;
    });

    const affected = updateMany(ids);

    // Fetch the updated logs
    const placeholders = ids.map(() => "?").join(",");
    const updatedLogs = db.prepare(`
      SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
      FROM usage_logs l
      LEFT JOIN students s ON l.process_number = s.process_number
      WHERE l.id IN (${placeholders})
    `).all(...ids);

    res.json({
      success: true,
      count: affected,
      exit_time: exitTime,
      logs: updatedLogs
    });
  } catch (error) {
    console.error("Error in bulk checkout:", error);
    res.status(500).json({ error: "Erro ao registar saídas em massa" });
  }
});

// Bulk delete: permanently delete multiple usage logs (requires password "escola")
app.post("/api/usage/bulk-delete", (req, res) => {
  const { ids, password } = req.body;

  if (password !== "escola") {
    return res.status(403).json({ error: "Palavra-passe incorreta. Apenas administradores autorizados podem eliminar registos." });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Nenhum registo selecionado para eliminar" });
  }

  try {
    const deleteStmt = db.prepare("DELETE FROM usage_logs WHERE id = ?");
    const deleteMany = db.transaction((logIds: number[]) => {
      let count = 0;
      for (const id of logIds) {
        const result = deleteStmt.run(id);
        count += result.changes;
      }
      return count;
    });

    const affected = deleteMany(ids);
    res.json({ success: true, count: affected });
  } catch (error) {
    console.error("Error in bulk delete:", error);
    res.status(500).json({ error: "Erro ao eliminar registos de utilização" });
  }
});

// Single delete: permanently delete a single usage log (requires password "escola")
app.post("/api/usage/:id/delete", (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (password !== "escola") {
    return res.status(403).json({ error: "Palavra-passe incorreta. Apenas administradores autorizados podem eliminar registos." });
  }

  try {
    const result = db.prepare("DELETE FROM usage_logs WHERE id = ?").run(id);
    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Registo não encontrado" });
    }
  } catch (error) {
    console.error("Error in single delete:", error);
    res.status(500).json({ error: "Erro ao eliminar registo" });
  }
});

app.get("/api/students/:id", (req, res) => {
  const student = db.prepare("SELECT * FROM students WHERE process_number = ?").get(req.params.id);
  if (student) {
    res.json(student);
  } else {
    res.status(404).json({ error: "Student not found" });
  }
});

app.post("/api/usage", (req, res) => {
  const { process_number, area, activity, entry_time, exit_time, date } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO usage_logs (process_number, area, activity, entry_time, exit_time, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(process_number, area, activity, entry_time, exit_time, date);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: "Failed to register usage" });
  }
});

app.get("/api/analysis", (req, res) => {
  const startDate = (req.query.startDate as string) || "1970-01-01";
  const endDate = (req.query.endDate as string) || "2099-12-31";
  
  const logs = db.prepare(`
    SELECT l.*, s.name, s.gender, s.class_number, s.grade, s.class 
    FROM usage_logs l
    LEFT JOIN students s ON l.process_number = s.process_number
    WHERE l.date BETWEEN ? AND ?
    ORDER BY l.date DESC, l.id DESC
  `).all(startDate, endDate);

  res.json(logs);
});

app.get("/api/spaces", (req, res) => {
  const spaces = db.prepare("SELECT * FROM library_spaces").all();
  res.json(spaces);
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

// Download sample template for usage CSV
app.get("/api/template/usage-csv", (req, res) => {
  const sampleCsv = "\uFEFFData;Processo;Área;Atividade;Hora Entrada;Hora Saída;Nome;Ano;Turma\r\n" +
    "2026-09-15;12345;Multimédia;Consola;10:15;11:00;Maria Silva Santos;8;B\r\n" +
    "2026-09-15;10001;Área de leitura;Livros Portugueses;10:30;11:15;João Pedro Ferreira;7;A\r\n" +
    "2026-09-16;10002;Área de Estudo;Matemática;14:00;14:45;Ana Beatriz Costa;9;C\r\n" +
    "2026-09-16;10003;Área de jogos;Xadrez;15:10;15:55;Tiago Miguel Oliveira;10;A\r\n";

  res.setHeader("Content-Disposition", "attachment; filename=modelo_registos_historicos.csv");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.send(Buffer.from(sampleCsv, "utf-8"));
});

// Download sample template for spaces
app.get("/api/template/spaces", (req, res) => {
  const sampleData = [
    { Area: "Multimédia", Atividade: "Consola" },
    { Area: "Multimédia", Atividade: "Mesa digital" },
    { Area: "Área de leitura", Atividade: "Livros Portugueses" },
    { Area: "Área de jogos", Atividade: "Xadrez" },
    { Area: "Área de Estudo", Atividade: "Matemática" }
  ];
  const ws = xlsx.utils.json_to_sheet(sampleData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Espacos");
  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", "attachment; filename=modelo_espacos.xlsx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

app.post("/api/upload-spaces", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet) as any[];

    if (!data || data.length === 0) {
      return res.status(400).json({ error: "O ficheiro Excel está vazio ou inválido." });
    }

    db.prepare("DELETE FROM library_spaces").run();

    const insert = db.prepare(`
      INSERT INTO library_spaces (area, activity)
      VALUES (?, ?)
    `);

    const transaction = db.transaction((spaces: any[]) => {
      for (const s of spaces) {
        const area = s.Area || s.area || s.Área || s["Área"];
        const activity = s.Atividade || s.atividade || s.Activity || s.activity;
        if (area && activity) {
          insert.run(String(area).trim(), String(activity).trim());
        }
      }
    });

    transaction(data);
    const count = (db.prepare("SELECT COUNT(*) as count FROM library_spaces").get() as { count: number }).count;
    res.json({ success: true, count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao processar ficheiro Excel de espaços" });
  }
});

app.post("/api/upload-students", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet) as any[];

    if (!data || data.length === 0) {
      return res.status(400).json({ error: "O ficheiro Excel está vazio ou sem registos." });
    }

    const insert = db.prepare(`
      INSERT OR REPLACE INTO students (process_number, name, gender, class_number, grade, class)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((students: any[]) => {
      for (const s of students) {
        const proc = s.Processo || s.process_number || s["N.º Processo"] || s["Nº Processo"] || s["Processo Nº"];
        const name = s.Nome || s.name || s["Nome Completo"] || s["Nome do Aluno"];
        const gender = s.Genero || s.gender || s.Género || s["Sexo"] || "Outro";
        const classNum = s.Numero || s.class_number || s.Número || s["Nº"] || s["N.º"] || null;
        const grade = s.Ano || s.grade || s["Ano de Escolaridade"] || null;
        const className = s.Turma || s.class || s["Turma "] || "";

        if (proc && name) {
          insert.run(Number(proc), String(name).trim(), String(gender).trim(), classNum ? Number(classNum) : null, grade ? Number(grade) : null, String(className).trim());
        }
      }
    });

    transaction(data);
    res.json({ success: true, count: data.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao processar ficheiro Excel de alunos" });
  }
});

// CSV parser helper for historical usage logs
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

function normalizeTime(raw: string): string {
  if (!raw) return "";
  const str = raw.trim();
  const match = str.match(/^(\d{1,2}):(\d{1,2})/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
  }
  return str;
}

// Upload historical usage logs via CSV
app.post("/api/upload-usage-csv", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum ficheiro foi carregado" });

  try {
    const rows = parseCsvBuffer(req.file.buffer);
    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: "O ficheiro CSV está vazio ou em formato inválido." });
    }

    const checkExistingStudent = db.prepare("SELECT process_number FROM students WHERE process_number = ?");
    const insertStudent = db.prepare(`
      INSERT OR IGNORE INTO students (process_number, name, gender, class_number, grade, class)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const checkExistingLog = db.prepare(`
      SELECT id FROM usage_logs 
      WHERE process_number = ? AND date = ? AND entry_time = ? AND area = ?
    `);

    const insertLog = db.prepare(`
      INSERT INTO usage_logs (process_number, area, activity, entry_time, exit_time, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertSpace = db.prepare(`
      INSERT INTO library_spaces (area, activity)
      SELECT ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM library_spaces WHERE LOWER(area) = LOWER(?) AND LOWER(activity) = LOWER(?)
      )
    `);

    let insertedCount = 0;
    let skippedCount = 0;

    const transaction = db.transaction((records: Record<string, string>[]) => {
      for (const r of records) {
        const findVal = (possibleKeys: string[]): string => {
          for (const key of Object.keys(r)) {
            const cleanKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            for (const pk of possibleKeys) {
              const cleanPk = pk.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              if (cleanKey === cleanPk) return r[key];
            }
          }
          return "";
        };

        const procStr = findVal(["processo", "process_number", "nº processo", "n.º processo", "proc", "numero"]);
        const proc = parseInt(procStr.replace(/\D/g, ""), 10);
        if (isNaN(proc) || proc <= 0) {
          skippedCount++;
          continue;
        }

        const dateRaw = findVal(["data", "date", "dia", "data de utilizacao"]);
        const date = normalizeDate(dateRaw);

        const area = findVal(["area", "espaco", "area a frequentar", "local"]) || "Área de Leitura";
        const activity = findVal(["atividade", "activity", "acao", "tarefa"]) || "Leitura / Estudo";

        const entryTimeRaw = findVal(["hora entrada", "hora de entrada", "entrada", "entry_time", "inicio", "hora inicio"]);
        const entryTime = normalizeTime(entryTimeRaw) || "09:00";

        const exitTimeRaw = findVal(["hora saida", "hora de saida", "saida", "exit_time", "fim", "hora fim"]);
        const exitTime = normalizeTime(exitTimeRaw);

        // Optional student metadata
        const studentName = findVal(["nome", "nome do aluno", "aluno", "nome completo"]);
        const studentGender = findVal(["genero", "sexo"]) || "Outro";
        const studentGrade = parseInt(findVal(["ano", "ano de escolaridade", "grade"]), 10) || null;
        const studentClass = findVal(["turma", "class"]);

        if (studentName) {
          insertStudent.run(proc, studentName, studentGender, null, studentGrade, studentClass);
        } else {
          const existing = checkExistingStudent.get(proc);
          if (!existing) {
            insertStudent.run(proc, `Aluno ${proc}`, "Outro", null, null, "");
          }
        }

        // Avoid duplicate log record
        const duplicate = checkExistingLog.get(proc, date, entryTime, area);
        if (duplicate) {
          skippedCount++;
          continue;
        }

        insertLog.run(proc, area, activity, entryTime, exitTime, date);
        insertSpace.run(area, activity, area, activity);
        insertedCount++;
      }
    });

    transaction(rows);

    res.json({
      success: true,
      count: insertedCount,
      skipped: skippedCount,
      total: rows.length
    });
  } catch (error) {
    console.error("Error in upload-usage-csv:", error);
    res.status(500).json({ error: "Erro ao processar ficheiro CSV de registos históricos" });
  }
});

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
