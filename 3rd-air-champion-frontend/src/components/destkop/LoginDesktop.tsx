import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { loginSchema, loginZodObject } from "./zodLogin";
import { zodResolver } from "@hookform/resolvers/zod";
import { authorizeUser } from "../../util/authorizeUser";
import { useState } from "react";
import { useNavigate } from "react-router";

interface LoginProps {
  listings: { url: string; label: string }[];
  setIsLogin: React.Dispatch<React.SetStateAction<boolean>>;
}

const Login = ({ listings, setIsLogin }: LoginProps) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<loginSchema>({ resolver: zodResolver(loginZodObject) });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const onSubmit: SubmitHandler<loginSchema> = (data) => {
    setIsLoading(true);
    authorizeUser({ email: data.email, password: data.password })
      .then((result) => {
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
    <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700" htmlFor="email">Email</label>
        <input
          id="email"
          type="text"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          {...register("email")}
        />
        {errors.email && <span className="text-red-500 text-xs">{errors.email.message}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          {...register("password")}
        />
        {errors.password && <span className="text-red-500 text-xs">{errors.password.message}</span>}
      </div>

      {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}

      <div className="flex gap-2 mt-1">
        <button
          type="submit"
          disabled={!watch("email") || Object.keys(errors).length > 0 || isLoading}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg py-2 text-sm disabled:bg-gray-300 transition-colors"
        >
          {isLoading ? "Logging in..." : "Login"}
        </button>
        <button
          type="button"
          onClick={() => setIsLogin(false)}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
        >
          Register
        </button>
      </div>

      {/* AirBnB listings */}
      <div className="flex flex-wrap text-xs text-gray-400 mt-2 gap-x-1">
        <span>Our listings on AirBnB:</span>
        {listings.map((listing, index) => (
          <React.Fragment key={listing.url}>
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline hover:text-blue-600"
            >
              {listing.label}
            </a>
            {index <= listings.length - 2 && (
              <span>{index === listings.length - 2 ? " and " : ","}</span>
            )}
          </React.Fragment>
        ))}
      </div>

    </form>
  );
};

export default Login;