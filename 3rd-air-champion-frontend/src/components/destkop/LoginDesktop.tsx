import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { loginSchema, loginZodObject } from "../../util/zodLogin";
import { zodResolver } from "@hookform/resolvers/zod";
import { authorizeUser } from "../../util/authorizeUser";
import { useState } from "react";
import { useNavigate } from "react-router";

interface LoginProps {
  listings: {
    url: string;
    label: string;
  }[];
  setIsLogin: React.Dispatch<React.SetStateAction<boolean>>;
}

const Login = ({ listings, setIsLogin }: LoginProps) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<loginSchema>({ resolver: zodResolver(loginZodObject) });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const navigate = useNavigate();

  const onSubmit: SubmitHandler<loginSchema> = (data) => {
    setIsLoading(true);
    authorizeUser({
      email: data.email,
      password: data.password,
    })
      .then((result) => {
        console.log("Login success:", result.account);
        localStorage.setItem("token", result.token);
        setIsLoading(false);
        navigate("/");
      })
      .catch((err) => {
        setErrorMessage(err);
        setIsLoading(false);
      });
  };

  return (
    <div className="flex flex-col justify-center items-center h-full">
      <form
        className="flex flex-col justify-center items-center bg-white w-full h-full rounded-md drop-shadow-md"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="flex items-center text-xl font-bold">
          <img
            src="./TiMagLogo.svg"
            alt="Logo"
            className={"h-[56px] w-[56px]"}
          />{" "}
          Welcome to TT House
        </div>
        <div className="flex flex-col p-1">
          <label htmlFor="email">Email</label>
          <input
            className="shadow-inner bg-[rgba(246,246,246,1)] p-2"
            id="email"
            type="text"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <span className="text-red-500 text-sm">{errors.email.message}</span>
        )}
        <div className="flex flex-col p-1">
          <label htmlFor="password">Password</label>
          <input
            className="shadow-inner bg-[rgba(246,246,246,1)] p-2"
            id="password"
            type="password"
            {...register("password")}
          />
        </div>
        {errors.password && (
          <span className="text-red-500 text-sm">
            {errors.password.message}
          </span>
        )}
        <div className="flex space-x-4">
          <button
            type="submit"
            className="bg-blue-400 drop-shadow rounded-md mt-2 p-2 disabled:bg-slate-500"
            disabled={
              !watch("email") || Object.keys(errors).length > 0 || isLoading
            }
          >
            Login
          </button>
          <button
            type="button"
            className="bg-green-400 drop-shadow rounded-md mt-2 p-2"
            onClick={() => setIsLogin(false)}
          >
            Register
          </button>
        </div>
        {errorMessage && <p className="text-red-500">{errorMessage}</p>}
        <div className="flex flex-wrap justify-center mt-2 gap-x-1">
          <span>Three listings on AirBnB: </span>
          {listings.map((listing, index) => (
            <React.Fragment key={listing.url}>
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline hover:text-blue-700"
              >
                {listing.label}
              </a>
              {index <= listings.length - 2 && (
                <span>{index === listings.length - 2 ? ", and " : ", "}</span>
              )}
            </React.Fragment>
          ))}
          <span>rooms.</span>
        </div>
      </form>
    </div>
  );
};

export default Login;
