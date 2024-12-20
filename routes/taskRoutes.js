//routes/taskRoutes.js
const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const Task = require('../models/userMadeTaskModel');
const router = express.Router();
const { unValidateTask } = require('../controllers/taskController');

// Créer une nouvelle tâche
router.post('/', protect, async (req, res) => {
  const { name, room, description, time, what, frequency } = req.body;
  console.log('Données reçues :', req.body);  // Afficher les données envoyées

  try {
    const newTask = new Task({
      name,
      description,
      time,
      frequency,
      room,
      what,  // Assurez-vous que 'what' est un tableau
      user: req.user._id,
    });

    await newTask.save();
    res.status(201).json(newTask);
  } catch (error) {
    console.error("Erreur lors de la création de la tâche :", error);
    res.status(500).json({ message: "Erreur lors de la création de la tâche", error });
  }
});

// Valider une tâche (marquer comme terminée)
router.put('/:taskId/done', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Tâche non trouvée' });
    }

    task.isDone = true;
    const now = new Date();
    task.dateDone = now; // Mise à jour de dateDone
    task.lastCompleted = now; // Mise à jour de lastCompleted
    task.nextDue = calculateNextDueDate(task.frequency); // Calculer la prochaine échéance selon la fréquence
    await task.save();

    res.status(200).json({ message: 'Tâche marquée comme terminée', task });
  } catch (error) {
    console.error("Erreur lors de la validation de la tâche :", error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la tâche', error });
  }
});

router.put('/:taskId/undone', protect, unValidateTask);

// Route pour récupérer toutes les tâches (publiques + privées)
router.get("/", protect, async (req, res) => {
  console.log("/");
  try {
    const userId = req.user._id; // Utiliser l'utilisateur authentifié
    const tasks = await Task.find({
      $or: [
        { user: userId }, // Tâches privées liées à l'utilisateur authentifié
        { isGlobal: true }  // Tâches globales visibles par tous
      ]
    });
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Erreur lors de la récupération des tâches :", error);
    res.status(500).json({ message: "Erreur lors de la récupération des tâches." });
  }
});

// Route pour récupérer toutes les tâches globales (publiques)
router.get("/global", async (req, res) => {
  console.log("global");
  try {
    const tasks = await Task.find({ isGlobal: true }); // Récupérer toutes les tâches globales
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Erreur lors de la récupération des tâches globales :", error);
    res.status(500).json({ message: "Erreur lors de la récupération des tâches globales." });
  }
});

// Route pour récupérer les tâches par pièce pour un utilisateur spécifique
router.get("/by-room", protect, async (req, res) => {
  console.log("by-room route hit");
  try {
    const userId = req.user._id; // Utiliser l'utilisateur authentifié
    const rooms = req.query.rooms.split(","); // Récupérer les pièces via les paramètres de requête

    // Trouver les tâches en fonction des pièces spécifiées et de l'utilisateur
    const tasks = await Task.find({
      $or: [
        { user: userId, room: { $in: rooms } }, // Tâches privées liées à l'utilisateur et filtrées par pièce
        { isGlobal: true, room: { $in: rooms } }  // Tâches globales visibles par tous et filtrées par pièce
      ]
    });

    console.log("Tasks found:", tasks); // Log des tâches récupérées

    res.status(200).json(tasks);
  } catch (error) {
    console.error("Erreur lors de la récupération des tâches par pièce :", error);
    res.status(500).json({ message: "Erreur lors de la récupération des tâches par pièce." });
  }
});


// Fonction pour calculer la prochaine date d'exécution selon la fréquence
const calculateNextDueDate = (frequency) => {
  const now = new Date();
  switch (frequency) {
    case 'Quotidienne':
      return new Date(now.setDate(now.getDate() + 1)); 
    case 'Hebdomadaire':
      return new Date(now.setDate(now.getDate() + 7)); 
    case 'Mensuelle':
      return new Date(now.setMonth(now.getMonth() + 1)); 
    case 'Quotidienne':
      return now;  
    case 'Trimestrielle':
      return new Date(now.setMonth(now.getMonth() + 3)); 
    case 'Semestrielle':
      return new Date(now.setMonth(now.getMonth() + 6)); 
    default:
      return now;
  }
};

// Route pour mettre à jour une tâche
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { isDone } = req.body;

  try {
    const updatedTask = await Task.findByIdAndUpdate(
      id,
      { isDone },
      { new: true }
    );
    if (!updatedTask) {
      return res.status(404).send({ message: "Tâche non trouvée." });
    }
    res.send(updatedTask);
  } catch (error) {
    res.status(500).send({ message: "Erreur serveur." });
  }
});

// Route pour récupérer uniquement les tâches terminées par pièce
router.get("/completed", protect, async (req, res) => {
  console.log("completed");

  try {
    const userId = req.user._id; // Utiliser l'utilisateur authentifié
    const rooms = req.query.rooms.split(","); // Récupérer les pièces via les paramètres de requête

    // Trouver les tâches terminées par utilisateur et filtrées par pièce
    const tasks = await Task.find({
      $or: [
        { user: userId, isDone: true, room: { $in: rooms } }, // Tâches terminées de l'utilisateur, filtrées par pièce
        { isGlobal: true, isDone: true, room: { $in: rooms } }  // Tâches globales terminées visibles par tous, filtrées par pièce
      ]
    });

    res.status(200).json(tasks);
  } catch (error) {
    console.error("Erreur lors de la récupération des tâches terminées :", error);
    res.status(500).json({ message: "Erreur lors de la récupération des tâches terminées." });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Tâche introuvable." });
    }
    res.status(200).json({ message: "Tâche supprimée avec succès." });
  } catch (error) {
    console.error("Erreur lors de la suppression :", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});


module.exports = router;
