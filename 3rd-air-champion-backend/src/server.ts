import dotenv from "dotenv";
import mongoose from "mongoose";
import express, { Request, Response } from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import http from "http";
import { resolvers } from "./graphql/resolvers";
import { typeDefs } from "./graphql/typeDefs";
import authorizationRoute from "./route/authenticationRoute";
import guestRoute from "./route/guestRoute";
import roomRoute from "./route/roomRoute";
import dayRoute from "./route/dayRoute";
import hostRoute from "./route/hostRoute";
import syncRoute from "./route/syncRoute";
import bookingRequestRoute from "./route/bookingRequestRoute";
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
  methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods
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

    // Public routes
    app.use("/auth", authorizationRoute);
    app.use("/booking-request", bookingRequestRoute);

    // Authenticate all paths from now on
    app.use(authenticateToken as any);

    // Protected Routes
    app.use("/host", hostRoute);
    app.use("/guest", guestRoute);
    app.use("/room", roomRoute);
    app.use("/day", dayRoute);
    app.use("/airbnb", syncRoute);

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
