import { zodResolver } from "@hookform/resolvers/zod";
import { registerZodObject, registerZodSchema } from "./zodRegister";
import { useState } from "react";
import { useNavigate } from "react-router";
import { SubmitHandler, useForm } from "react-hook-form";
import { registerUser } from "../../util/authorizeUser";

interface RegisterProps {
  setIsLogin: React.Dispatch<React.SetStateAction<boolean>>;
}

const Register = ({ setIsLogin }: RegisterProps) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<registerZodSchema>({ resolver: zodResolver(registerZodObject) });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const navigate = useNavigate();

  const onSubmit: SubmitHandler<registerZodSchema> = (data) => {
    setIsLoading(true);
    registerUser({
      email: data.email,
      name: data.name,
      password: data.password,
    })
      .then((result) => {
        console.log("register success:", result.account);
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
          <label htmlFor="name">Name</label>
          <input
            className="shadow-inner bg-[rgba(246,246,246,1)] p-2"
            id="name"
            type="text"
            {...register("name")}
          />
        </div>
        {errors.name && (
          <span className="text-red-500 text-sm">{errors.name.message}</span>
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
            Register
          </button>
          <button
            type="submit"
            className="bg-green-400 drop-shadow rounded-md mt-2 p-2"
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
        </div>
        {errorMessage && <p className="text-red-500">{errorMessage}</p>}
      </form>
    </div>
  );
};

export default Register;
