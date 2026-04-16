import { useState } from "react";
import Login from "./LoginDesktop";
import Register from "./Register";

const Authorization = () => {
  const [isLogin, setIsLogin] = useState(true);

  const listings = [
    {
      url: "https://www.airbnb.com/rooms/1177648203505001777",
      label: "Cozy",
    },
    {
      url: "https://www.airbnb.com/rooms/1144526275550691711",
      label: "Cute",
    },
    {
      url: "https://www.airbnb.com/rooms/1400962263132112124",
      label: "Chill",
    },
  ];

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Demo Images */}
      <div className="w-full h-1/3 flex items-center justify-center">
        <img
          src={"./FullDemo.jpg"}
          alt="House"
          className="max-h-full max-w-full object-contain"
        />
      </div>

      {/* AirBnB Reviews */}
      <div className="w-full flex flex-col items-center my-2">
        <img
          src={"./Login/UserReview.jpg"}
          alt="User Reviews"
          className="max-w-[256px] mb-4"
        />
        <div className="flex w-full max-w-[80%] items-center justify-center space-x-4 mb-4">
          <div className="flex-shrink-0 flex items-center justify-center">
            <img
              src={"./Login/ProfilePic.jpg"}
              alt="Profile Image"
              className="w-[44px] h-[44px] object-contain"
            />
          </div>
          <span>Stay with Anh-Tuan, AirBnB Super host, PhD, Engineer</span>
        </div>

        <div className="flex w-full max-w-[80%] items-center justify-center space-x-4">
          <div className="flex-shrink-0 flex items-center justify-center">
            <img
              src={"./Login/Trophy.jpg"}
              alt="Trophy"
              className="w-[44px] h-[44px] object-contain"
            />
          </div>
          <span>
            Top 5% of homes based on ratings, ranking, and reliability.
          </span>
        </div>
      </div>

      {/* Login/ Register */}
      <div className="h-full">
        {isLogin ? (
          <Login listings={listings} setIsLogin={setIsLogin} />
        ) : (
          <Register setIsLogin={setIsLogin} />
        )}
      </div>
    </div>
  );
};

export default Authorization;
