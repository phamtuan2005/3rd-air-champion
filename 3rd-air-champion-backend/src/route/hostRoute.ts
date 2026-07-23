import express, { Request, Response } from "express";
import { sendGraphQLRequest } from "./util/sendToGraphQL";

const router = express.Router();

router.post("/get", async (req: Request, res: any) => {
    const query = `
              query Hosts {
                hosts {
                  id
                  name
                  }
              }
      `;
  
    sendGraphQLRequest(query)
      .then((result: any) => {
        if (result.errors) {
          return res.status(400).json({ errors: result.errors[0].message });
        }
        // Send the successful login response
        res.status(200).json(result.data.hosts);
      })
      .catch((error: any) => {
        // Handle errors from the helper function
        res.status(500).json({ error: error.message });
      });
});

router.post("/get/one", async (req: Request, res: any) => {
  const { id } = req.body;

  const query = `
            query Host($id: String!) {
                host(_id: $id) {
                    guests
                    email
                    rooms
                    airbnbsync {
                      room
                      link
                    }
                    name
                    cohosts
                    calendar
                    doorCode
                    airbnbName
                    airbnbAddress
                    airbnbRating
                    airbnbReviewCount
                    airbnbReviewsUrl
                    airbnbProfileUrl
                    cohostProfileUrls
                    airbnbSuperhost
                    highlights
                    houseRules
                    cleaningRules
                    phone
                    contactEmail
                    licenseNumber
                    cancellationFullRefundDays
                    cancellationHalfRefundDays
                }
            }
    `;

  sendGraphQLRequest(query, { id })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.host);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.post("/update/one", async (req: Request, res: any) => {
  const { id } = req.body;

  const query = `
            query Host($id: String!) {
                host(_id: $id) {
                    guests
                    email
                    rooms
                    airbnbsync {
                      room
                      link
                    }
                    name
                    cohosts
                    calendar
                }
            }
    `;

  sendGraphQLRequest(query, { id })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.host);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.post("/update/sync", async (req: Request, res: any) => {
  const { id, airbnbsync } = req.body;

  const query = `
            mutation UpdateHost($id: String!, $airbnbsync: String) {
              updateHost(_id: $id, airbnbsync: $airbnbsync) {
                airbnbsync {
                  link
                  room
                }
              }
            }`;

  sendGraphQLRequest(query, { id, airbnbsync })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.updateHost);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.put("/update/doorcode", async (req: Request, res: any) => {
  const { id, doorCode } = req.body;

  const query = `
            mutation UpdateHost($id: String!, $doorCode: String) {
              updateHost(_id: $id, doorCode: $doorCode) {
                doorCode
              }
            }`;

  sendGraphQLRequest(query, { id, doorCode })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.updateHost);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});


router.put('/update/airbnbinfo', async (req: Request, res: any) => {
  const { id, doorCode, airbnbName, airbnbAddress, airbnbRating, airbnbReviewCount, airbnbReviewsUrl, airbnbProfileUrl, cohostProfileUrls, airbnbSuperhost, highlights, houseRules, cleaningRules, phone, contactEmail, licenseNumber, cancellationFullRefundDays, cancellationHalfRefundDays } = req.body;

  const query = `
    mutation UpdateHost($id: String!, $doorCode: String, $airbnbName: String, $airbnbAddress: String, $airbnbRating: Float, $airbnbReviewCount: Int, $airbnbReviewsUrl: String, $airbnbProfileUrl: String, $cohostProfileUrls: [String], $airbnbSuperhost: Boolean, $highlights: [String], $houseRules: String, $cleaningRules: String, $phone: String, $contactEmail: String, $licenseNumber: String, $cancellationFullRefundDays: Int, $cancellationHalfRefundDays: Int) {
      updateHost(_id: $id, doorCode: $doorCode, airbnbName: $airbnbName, airbnbAddress: $airbnbAddress, airbnbRating: $airbnbRating, airbnbReviewCount: $airbnbReviewCount, airbnbReviewsUrl: $airbnbReviewsUrl, airbnbProfileUrl: $airbnbProfileUrl, cohostProfileUrls: $cohostProfileUrls, airbnbSuperhost: $airbnbSuperhost, highlights: $highlights, houseRules: $houseRules, cleaningRules: $cleaningRules, phone: $phone, contactEmail: $contactEmail, licenseNumber: $licenseNumber, cancellationFullRefundDays: $cancellationFullRefundDays, cancellationHalfRefundDays: $cancellationHalfRefundDays) {
        doorCode
        airbnbName
        airbnbAddress
        airbnbRating
        airbnbReviewCount
        airbnbReviewsUrl
        airbnbProfileUrl
        cohostProfileUrls
        airbnbSuperhost
        highlights
        houseRules
        cleaningRules
        phone
        contactEmail
        licenseNumber
        cancellationFullRefundDays
        cancellationHalfRefundDays
      }
    }`;

  sendGraphQLRequest(query, { id, doorCode, airbnbName, airbnbAddress, airbnbRating, airbnbReviewCount, airbnbReviewsUrl, airbnbProfileUrl, cohostProfileUrls, airbnbSuperhost, highlights, houseRules, cleaningRules, phone, contactEmail, licenseNumber, cancellationFullRefundDays, cancellationHalfRefundDays })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.updateHost);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

export default router;
