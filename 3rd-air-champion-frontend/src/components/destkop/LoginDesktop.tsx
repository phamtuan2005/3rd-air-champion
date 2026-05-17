import { useForm, SubmitHandler } from "react-hook-form";
import { loginSchema, loginZodObject } from "./zodLogin";
import { zodResolver } from "@hookform/resolvers/zod";
import { authorizeUser } from "../../util/authorizeUser";
import { useState } from "react";
import { useNavigate } from "react-router";

interface LoginProps {
  setIsLogin: (v: boolean) => void;
}

const Login = ({ setIsLogin }: LoginProps) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<loginSchema>({ resolver: zodResolver(loginZodObject) });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const onSubmit: SubmitHandler<loginSchema> = (data) => {
    setIsLoading(true);
    authorizeUser({ email: data.email, password: data.password })
      .then((result) => {
        localStorage.setItem("token", result.token);
        localStorage.setItem("pendingSync", "true");
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
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            {...register("password")}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            )}
          </button>
        </div>
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


    </form>
  );
};

export default Login;