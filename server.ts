import express from "express";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const prisma = new PrismaClient();

async function createServer() {
  const app = express();
  
  app.use(cors());
  app.use(express.json());

  // Check database connection on startup
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");
  } catch (err) {
    console.error("❌ Database connection failed:", err);
  }

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API Routes
  app.get("/api/db-status", async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "connected", database: "PostgreSQL" });
    } catch (err) {
      res.status(500).json({ status: "error", message: String(err) });
    }
  });

  app.get("/api/plates", async (req, res) => {
    try {
      const plates = await prisma.plate.findMany({
        orderBy: {
          entryDate: 'desc'
        }
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json(plates);
    } catch (err) {
      console.error("Error fetching plates:", err);
      res.status(500).json({ error: "Failed to fetch plates", details: String(err) });
    }
  });

  app.post("/api/plates", async (req, res) => {
    const p = req.body;
    try {
      const data = {
        plateNumber: String(p.plateNumber || ''),
        category: String(p.category || ''),
        plateType: String(p.plateType || ''),
        quantity: String(p.quantity || '1'),
        reportNumber: String(p.reportNumber || ''),
        seizureDate: String(p.seizureDate || ''),
        trafficSupplyDate: String(p.trafficSupplyDate || ''),
        vehicleModel: String(p.vehicleModel || ''),
        supplyingEntity: String(p.supplyingEntity || ''),
        seizedItems: String(p.seizedItems || ''),
        actionsTaken: String(p.actionsTaken || ''),
        entryDate: String(p.entryDate || new Date().toISOString()),
        status: String(p.status || 'COMPLETED'),
        notes: String(p.notes || '')
      };

      await prisma.plate.upsert({
        where: { id: p.id },
        update: data,
        create: {
          id: p.id,
          ...data
        }
      });
      res.json({ success: true, message: "تم الحفظ" });
    } catch (err) {
      console.error("Error saving plate:", err);
      res.status(500).json({ error: "Failed to save plate" });
    }
  });

  app.delete("/api/plates/:id", async (req, res) => {
    try {
      await prisma.plate.delete({
        where: { id: req.params.id }
      });
      res.json({ success: true, message: "تم الحذف" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete plate" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    // Handle SPA routing in production
    app.get("*", (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(new URL('./dist/index.html', import.meta.url).pathname);
    });
  }

  return app;
}

const appPromise = createServer();

// For local development
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  appPromise.then(app => {
    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
