import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { sendGraphQLRequest } from "./util/sendToGraphQL";

dotenv.config();

const router = express.Router();
const SECRET_TOKEN =
  process.env.SECRET_TOKEN ||
  "509ea5f1fd64b855c9c372453b8f114593d1aabdb02653e880b4432f661d0eaee73bc06d631064b0ec8c0ecb4b77656b4fa0390dc0805812c365a7f15891efa1";

// Helper to generate JWT
const generateToken = (payload: Record<string, any>) => {
  return jwt.sign(payload, SECRET_TOKEN, { expiresIn: "1h" });
};

// Login Route
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const query = `
        query Login($email: String!, $password: String!) {
            login(email: $email, password: $password) {
                cohostId
                cohostName
                hostId
                role
            }
        }`;

  sendGraphQLRequest(query, { email, password })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      const account = result.data.login;
      const token = generateToken(account);

      // Send the successful login response
      res.status(200).json({ account, token });
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

// Register route
router.post("/register", async (req: Request, res: Response) => {
  const { email, password, name, host } = req.body;

  let query = ``;
  let variables: Record<string, any> = { email, password, name };

  // Regist cohost
  if (host) {
    query = `
            mutation RegisterCohost($host: String!, $email: String!, $password: String!, $name: String!) {
                registerCohost(host: $host, email: $email, password: $password, name: $name) {
                    cohostId
                    hostId
                    role
                }
            }
        `;
    variables.host = host;
  } else {
    query = `
            mutation RegisterHost($email: String!, $password: String!, $name: String!) {
                registerHost(email: $email, password: $password, name: $name) {
                    cohostId
                    hostId
                    role
                }
            }
        `;
  }

  sendGraphQLRequest(query, variables)
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      const account = host
        ? result.data.registerCohost
        : result.data.registerHost;
      const token = generateToken(account);

      // Send the successful login response
      res.status(200).json({ account, token });
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

export default router;
