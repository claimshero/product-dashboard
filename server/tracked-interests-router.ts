import { Router } from "express";
import {
  loadTrackedInterests,
  addTrackedInterest,
  updateTrackedInterest,
  removeTrackedInterest,
} from "./tracked-interests.js";

export const trackedInterestsRouter = Router();

trackedInterestsRouter.get("/api/tracked-interests", (_req, res) => {
  res.json({ interests: loadTrackedInterests() });
});

trackedInterestsRouter.post("/api/tracked-interests", (req, res) => {
  const { topic, category, context, sourceUrl } = req.body as {
    topic?: string;
    category?: string;
    context?: string;
    sourceUrl?: string;
  };
  if (!topic || typeof topic !== "string") {
    res.status(400).json({ error: "topic is required" });
    return;
  }
  const interest = addTrackedInterest(topic, context, sourceUrl, category);
  res.status(201).json(interest);
});

trackedInterestsRouter.patch("/api/tracked-interests/:id", (req, res) => {
  const { topic, category, context, sourceUrl } = req.body as {
    topic?: string;
    category?: string;
    context?: string;
    sourceUrl?: string;
  };
  const updated = updateTrackedInterest(req.params.id, { topic, category, context, sourceUrl });
  if (!updated) {
    res.status(404).json({ error: "Interest not found" });
    return;
  }
  res.json(updated);
});

trackedInterestsRouter.delete("/api/tracked-interests/:id", (req, res) => {
  const removed = removeTrackedInterest(req.params.id);
  if (!removed) {
    res.status(404).json({ error: "Interest not found" });
    return;
  }
  res.json({ ok: true });
});
