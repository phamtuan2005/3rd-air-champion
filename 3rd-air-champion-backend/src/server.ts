import dotenv from "dotenv";
import cron from "node-cron";
import mongoose from "mongoose";
import { autoSyncAllHosts } from "./jobs/autoSync";
import express, { Request, Response } from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import http from "http";
import path from "path";
import { resolvers } from "./graphql/resolvers";
import { typeDefs } from "./graphql/typeDefs";
import authorizationRoute from "./route/authenticationRoute";
import guestRoute from "./route/guestRoute";
import roomRoute from "./route/roomRoute";
import dayRoute from "./route/dayRoute";
import hostRoute from "./route/hostRoute";
import syncRoute from "./route/syncRoute";
import bookingRequestRoute from "./route/bookingRequestRoute";
import wishListRoute from "./route/wishListRoute";
import { authenticateToken } from "./middleware/authenticateJWT";
import cors from "cors";

dotenv.config();

const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI || "";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const corsOptions = {
  origin: (origin: any, callback: any) => {
    // Allow requests with no origin (e.g., server-to-server requests or curl)
    if (
      !origin ||
      CLIENT_ORIGIN.includes(origin) ||
      origin === `http://localhost:${PORT}`
    ) {
      callback(null, true);
    } else {
      callback(new Error(`${origin}: Not allowed by CORS`));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], // Allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  credentials: true, // Allow cookies and credentials
};

const startServer = async () => {
  try {
    // Database Connection
    await mongoose
      .connect(MONGO_URI)
      .then(() => {
        console.log("MongoDB connected");
      })
      .catch((error) => {
        console.log(`Error: ${error}`);
      });

    // Initialize Express
    const app = express();
    const httpServer = http.createServer(app);

    // Initialize Apollo Server
    const server = new ApolloServer({
      typeDefs,
      resolvers,
      plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    });

    await server.start();

    app.use(express.json()); // Middleware for parsing JSON requests
    app.use(cors(corsOptions));
    // Use Apollo Server Middleware
    app.use(
      "/graphql",
      cors<cors.CorsRequest>(corsOptions),
      expressMiddleware(server) as any
    );

    // Landing route
    app.get("/", (req: Request, res: Response) => {
      res.status(200).json({ message: "Hello World!" });
    });

    const apiRouter = express.Router();

    // Static uploads
    apiRouter.use("/uploads", express.static(path.join(__dirname, "../uploads")));

    // Public routes
    apiRouter.use("/auth", authorizationRoute);
    apiRouter.use("/booking-request", bookingRequestRoute);
    apiRouter.use("/wish-list", wishListRoute);

    // Authenticate all paths from now on
    apiRouter.use(authenticateToken as any);

    // Protected Routes
    apiRouter.use("/host", hostRoute);
    apiRouter.use("/guest", guestRoute);
    apiRouter.use("/room", roomRoute);
    apiRouter.use("/day", dayRoute);
    apiRouter.use("/airbnb", syncRoute);

    app.use("/api", apiRouter);

    // Run AirBnB sync every 30 minutes
    cron.schedule("*/30 * * * *", () => {
      console.log("[AutoSync] Running scheduled AirBnB sync...");
      autoSyncAllHosts().catch((err) =>
        console.error("[AutoSync] Unhandled error:", err.message)
      );
    });
    console.log("[AutoSync] AirBnB sync scheduled every 30 minutes.");

    console.log(`Express server ready at http://localhost:${PORT}/`);

    // Start the HTTP Server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    });
  } catch (error) {
    console.error("Server startup error:", error);
  }
};

// Call the async function to start the server
startServer();
