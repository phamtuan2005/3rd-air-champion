import { useState } from "react";
import { createPortal } from "react-dom";
import Login from "./LoginDesktop";
import Register from "./Register";


const Authorization = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="w-full h-screen overflow-y-auto bg-gray-50">

      {/* Property photo */}
      <div className="w-full">
        <img
          src="./FullDemo.jpg"
          alt="TT House"
          className="w-full object-cover"
          style={{ maxHeight: "45vh" }}
        />
      </div>

      {/* Content below the photo */}
      <div className="flex justify-center px-4 py-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-6 flex flex-col gap-4">

          {/* Logo + headline */}
          <div className="flex items-center gap-3">
            <img src="./TiMagLogo.svg" alt="TiMag" className="w-9 h-9" />
            <div>
              <p className="text-lg font-bold text-gray-800 leading-tight">TT House</p>
              <p className="text-xs text-gray-400">Your home, your guests, your pride</p>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-bold text-gray-800">Welcome back</h1>
            <p className="text-sm text-gray-400">Your guests are looking forward to staying with you.</p>
          </div>

          {/* Host + Trophy */}
          <div className="flex gap-3">
            <div className="flex items-center gap-2 flex-1 bg-gray-50 rounded-xl px-3 py-2">
              <img
                src="./Login/ProfilePic.jpg"
                alt="Host"
                className="w-9 h-9 rounded-full object-cover border-2 border-green-400 flex-shrink-0"
              />
              <div>
                <p className="text-xs font-semibold text-gray-800 leading-tight">Anh-Tuan</p>
                <p className="text-xs text-gray-500">Superhost · PhD · Engineer</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <img src="./Login/Trophy.jpg" alt="Trophy" className="w-8 h-8 object-contain flex-shrink-0" />
              <p className="text-xs text-amber-700 font-medium leading-tight">Top 5%<br />of homes</p>
            </div>
          </div>

          {/* Guest review */}
          <img
            src="./Login/UserReview.jpg"
            alt="Guest reviews"
            className="w-full rounded-xl border border-gray-100 shadow-sm object-contain max-h-16"
          />

          {isLogin ? (
            <button
              type="button"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
              onClick={() => setShowModal(true)}
            >
              Sign in
            </button>
          ) : (
            <Register setIsLogin={setIsLogin} />
          )}

        </div>
      </div>

      {/* Login modal */}
      {showModal && createPortal(
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 px-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl px-8 py-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Sign in</h2>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                onClick={() => setShowModal(false)}
              >
                &times;
              </button>
            </div>
            <Login setIsLogin={setIsLogin} />
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default Authorization;