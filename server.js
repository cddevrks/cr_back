const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const bodyParser = require("body-parser");

// Initialize the Express app
const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/registration_db", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// MongoDB Schema and Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  state: { type: String, required: true },
  district: { type: String, required: true },
  representative_type: { type: String, required: true },
  college: { type: String },
  school: { type: String },
  year_of_study: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Password stored as hash
});

const User = mongoose.model("User", userSchema);

// Registration route
app.post("/api/submit-form", async (req, res) => {
  const {
    name,
    phone,
    state,
    district,
    representative_type,
    college,
    school,
    year_of_study,
    email,
    password,
  } = req.body;
  if (
    !name ||
    !phone ||
    !email ||
    !password ||
    !state ||
    !district ||
    !representative_type ||
    !year_of_study
  ) {
    return res.status(400).json({
      status: "error",
      message: "Please fill out all required fields",
    });
  }

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ status: "error", message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user document
    const newUser = new User({
      name,
      phone,
      state,
      district,
      representative_type,
      college: representative_type === "college" ? college : "",
      school: representative_type === "school" ? school : "",
      year_of_study,
      email,
      password: hashedPassword,
    });

    // Save the user to the database
    await newUser.save();

    res.json({ status: "success", message: "Registration successful" });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// Sign-in route
app.post("/api/sign-in", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ status: "error", message: "User not found" });
    }

    // Compare the password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid credentials" });
    }

    // Successful login
    res.json({ status: "success", message: "Login successful" });
  } catch (error) {
    console.error("Error during sign-in:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// Task Schema
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  deadline: { type: Date },
  points: { type: Number, required: true },
  submissionType: { type: String }, // "individual" or "team"
  created_at: { type: Date, default: Date.now },
});

const Task = mongoose.model("Task", taskSchema);

// Update the Leaderboard Schema
const leaderboardSchema = new mongoose.Schema({
  email: { type: String, ref: "User", required: true, unique: true },
  points: { type: Number, default: 0 },
});

const Leaderboard = mongoose.model("Leaderboard", leaderboardSchema);

// Task submission schema
const taskSubmissionSchema = new mongoose.Schema({
  email: { type: String, required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
  link: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
  pointsAwarded: { type: Number, default: null },
});

const TaskSubmission = mongoose.model("TaskSubmission", taskSubmissionSchema);

// Admin can upload tasks
app.post("/api/admin/upload-task", async (req, res) => {
  const { title, description, deadline, points, submissionType } = req.body;

  if (!title || !description || !points) {
    return res
      .status(400)
      .json({ status: "error", message: "Please provide all required fields" });
  }

  try {
    const newTask = new Task({
      title,
      description,
      deadline,
      points,
      submissionType,
    });
    await newTask.save();

    res.json({ status: "success", message: "Task uploaded successfully" });
  } catch (error) {
    console.error("Error uploading task:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// Get all tasks
app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await Task.find({});
    res.json({ status: "success", tasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// User submits task with a Google Drive link
app.post("/api/submit-task", async (req, res) => {
  const { email, taskId, link } = req.body;

  if (!email || !taskId || !link) {
    return res
      .status(400)
      .json({ status: "error", message: "Please provide all required fields" });
  }

  try {
    const user = await User.findOne({ email });
    const task = await Task.findById(taskId);

    if (!user || !task) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid user or task" });
    }

    // Check if a submission already exists for this user and task
    const existingSubmission = await TaskSubmission.findOne({ email, taskId });
    if (existingSubmission) {
      return res.status(400).json({
        status: "error",
        message: "You have already submitted this task",
      });
    }

    // Create a new task submission
    const newSubmission = new TaskSubmission({
      email,
      taskId,
      link,
    });

    await newSubmission.save();

    res.json({ status: "success", message: "Task submitted successfully" });
  } catch (error) {
    console.error("Error submitting task:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// Admin updates points for a submission
app.post("/api/admin/update-points", async (req, res) => {
  const { email, taskId, pointsAwarded } = req.body;

  if (!email || !taskId || pointsAwarded === undefined) {
    return res
      .status(400)
      .json({ status: "error", message: "Please provide all required fields" });
  }

  try {
    const submission = await TaskSubmission.findOne({ email, taskId });
    if (!submission) {
      return res
        .status(400)
        .json({ status: "error", message: "Submission not found" });
    }

    submission.pointsAwarded = pointsAwarded;
    await submission.save();

    // Update or create leaderboard entry
    let leaderboard = await Leaderboard.findOne({ email });
    if (!leaderboard) {
      leaderboard = new Leaderboard({ email, points: pointsAwarded });
    } else {
      leaderboard.points += pointsAwarded;
    }
    await leaderboard.save();

    res.json({ status: "success", message: "Points updated successfully" });
  } catch (error) {
    console.error("Error updating points:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// Get the leaderboard
app.get("/api/leaderboard", async (req, res) => {
  try {
    const leaderboard = await Leaderboard.find({}).sort({ points: -1 }).lean();

    // Fetch user details separately
    const leaderboardWithDetails = await Promise.all(
      leaderboard.map(async (entry) => {
        const user = await User.findOne({ email: entry.email })
          .select("name college")
          .lean();
        return {
          name: user ? user.name : "Unknown User",
          college: user ? user.college : "Unknown College",
          points: entry.points,
        };
      })
    );

    res.json({ status: "success", leaderboard: leaderboardWithDetails });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// Profile Route - Fetch user profile
app.get("/api/profile", async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Email is required" });
    }

    // Find the user by their email in the database
    const user = await User.findOne({ email }).select("-password"); // Exclude the password field

    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    // Return user profile data
    res.json({
      status: "success",
      profile: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        representativeType: user.representative_type,
        college: user.college,
        district: user.district,
        state: user.state,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log("Server is running on http://localhost:${PORT}");
});
