import express, { Request, Response } from "express";
import { sendGraphQLRequest } from "./util/sendToGraphQL";
import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const roomName = ((req.query.roomName as string) || req.body.roomName || "misc").replace(/[^a-zA-Z0-9-_]/g, "_");
    const dir = path.join(__dirname, "../../uploads/rooms", roomName);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, "_");
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const router = express.Router();


router.post("/photos/upload", (req: Request, res: any, next: any) => {
  upload.single("photo")(req, res, (err: any) => {
    if (err) {
      const message = err.code === "LIMIT_FILE_SIZE" ? "File too large (max 10 MB)" : err.message;
      return res.status(400).json({ error: message });
    }
    next();
  });
}, async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  if (!req.file)
    return res.status(400).json({ error: "No file uploaded" });

  const roomName = ((req.query.roomName as string) || req.body.roomName || "misc").replace(/[^a-zA-Z0-9-_]/g, "_");
  const url = `/uploads/rooms/${roomName}/${req.file.filename}`;
  res.status(200).json({ url });
});

router.post("/create", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { name, price, roomCode, color } = req.body;
  const { hostId } = req.user as any;

  const query = `
        mutation CreateRoom($host: String!, $name: String!, $price: Float!, $roomCode: String, $color: String) {
            createRoom(host: $host, name: $name, price: $price, roomCode: $roomCode, color: $color) {
                id
                name
                price
                roomCode
                color
            }
        }`;

  const variables: { host: string; name: string; price: number; roomCode?: string; color?: string } = { name, price, host: hostId };
  if (roomCode !== undefined) variables.roomCode = roomCode;
  if (color !== undefined) variables.color = color;

  sendGraphQLRequest(query, variables)
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.createRoom);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.get("/get", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const query = `
        query Rooms {
            rooms {
                id
                name
                price
            }
        }`;

  sendGraphQLRequest(query)
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.rooms);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.post("/get/host", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { host } = req.body;

  const query = `
        query RoomsHost($host: String!) {
          roomsHost(host: $host) {
            id
            name
            price
            roomCode
            color
            active
            photos
            airbnbUrl
          }
        }`;

  sendGraphQLRequest(query, { host })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.roomsHost);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.post("/get/one", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { id } = req.body;

  const query = `
          query Room ($id: String!) {
              room (_id: $id) {
                  id
                  name
                  price
              }
          }`;

  sendGraphQLRequest(query, { id })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.room);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.put("/update", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { id, name, price, roomCode, color, active, photos, airbnbUrl } = req.body;

  const variables: {
    id: string;
    name?: string;
    price?: number;
    roomCode?: string;
    color?: string;
    active?: boolean;
    photos?: string[];
    airbnbUrl?: string;
  } = { id };
  if (name !== undefined) variables.name = name;
  if (price !== undefined) variables.price = price;
  if (roomCode !== undefined) variables.roomCode = roomCode;
  if (color !== undefined) variables.color = color;
  if (active !== undefined) variables.active = active;
  if (photos !== undefined) variables.photos = photos;
  if (airbnbUrl !== undefined) variables.airbnbUrl = airbnbUrl;

  const query = `
          mutation UpdateRoom($id: String!, $name: String, $price: Float, $roomCode: String, $color: String, $active: Boolean, $photos: [String], $airbnbUrl: String) {
                updateRoom(_id: $id, name: $name, price: $price, roomCode: $roomCode, color: $color, active: $active, photos: $photos, airbnbUrl: $airbnbUrl) {
                    id
                    name
                    price
                    roomCode
                    color
                    active
                    photos
                    airbnbUrl
                }
            }`;

  sendGraphQLRequest(query, variables)
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.updateRoom);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

router.post("/delete", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { roomIds } = req.body;
  const { hostId } = req.user as any;

  const query = `
            mutation DeleteRooms($id: String!, $roomIds: [String!]!) {
                deleteRooms(_id: $id, roomIds: $roomIds) {
                    rooms
                }
            }`;

  sendGraphQLRequest(query, { id: hostId, roomIds })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.deleteRooms);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

export default router;
