import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export const postSetting = async (reminderTemplate: string) => {
    console.log(BACKEND_ENDPOINT)
    console.log("reminderTemplate:", reminderTemplate)

  return axios
    .post(
      `${BACKEND_ENDPOINT}/setting`,
      { reminderTemplate: reminderTemplate }
      /*{
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }*/
    )
    .then((result) => result.data)
    .catch((err) => {
      if (err.response && err.response.data && err.response.data.errors) {
        throw err.response.data.errors;
      }
      // Default error message if no backend message is available
      throw "An unexpected error occurred. Please try again.";
    });
};

export const getSetting = async () => {
    
  return axios
    .get(
      `${BACKEND_ENDPOINT}/setting`      
      /*{
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }*/
    )
    .then((result) => result.data)
    .catch((err) => {
      if (err.response && err.response.data && err.response.data.errors) {
        throw err.response.data.errors;
      }
      // Default error message if no backend message is available
      throw "An unexpected error occurred. Please try again.";
    });
};
