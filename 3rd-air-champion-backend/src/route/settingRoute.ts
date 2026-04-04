import express, { Request, Response } from "express";
import House from "../model/houseSchema";
import mongoose from "mongoose";

const router = express.Router();

// Landing route
router.post("/", async (req: Request, res: Response) => {
    const payload = req.body

    if(payload && payload.reminderTemplate)  {
        const reminderTemplate = payload.reminderTemplate;

        const foundReminder = await House.find()


            const _id = foundReminder[0]._id
            await House.findByIdAndUpdate(
                _id,
                {reminderTemplate: reminderTemplate}
            )

        res.status(200).json({ message: "Successfully updated the reminder!" });
        return;
    }

    res.status(200).json({ message: "Hello TiMag setting!" });
    console.log(payload)      
});

router.get("/", async (req: Request, res: Response) => {
    
    const foundReminder = await House.find()
    const reminderMessage = foundReminder[0].reminderTemplate
            
    res.status(200).json({ reminderTemplate: reminderMessage });
    return;   
});

export default router