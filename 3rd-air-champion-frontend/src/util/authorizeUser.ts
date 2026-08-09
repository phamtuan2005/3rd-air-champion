import axios from "axios";
const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export const authorizeUser = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  return axios
    .post(`${BACKEND_ENDPOINT}/auth/login`, {
      email: email,
      password: password,
    })
    .then((result) => {
      const { account, token, refreshToken } = result.data;
      return { account, token, refreshToken };
    })
    .catch((err) => {
      if (err.response && err.response.data && err.response.data.errors) {
        throw err.response.data.errors;
      }
      // Default error message if no backend message is available
      throw `An unexpected error occurred. Please try again.`;
    });
};

export const registerUser = async ({
  email,
  name,
  password,
}: {
  email: string;
  name: string;
  password: string;
}) => {
  return axios
    .post(`${BACKEND_ENDPOINT}/auth/register`, {
      email: email,
      name: name,
      password: password,
    })
    .then((result) => {
      const { account, token, refreshToken } = result.data;
      return { account, token, refreshToken };
    })
    .catch((err) => {
      if (err.response && err.response.data && err.response.data.errors) {
        throw err.response.data.errors;
      }
      // Default error message if no backend message is available
      throw `An unexpected error occurred. Please try again.`;
    });
};
