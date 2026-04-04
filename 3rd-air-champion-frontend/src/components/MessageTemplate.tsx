import React, { useEffect, useState } from "react";
import { getSetting, postSetting } from "../util/settingOperations";

interface MessageTemplateProps {
  setIsMessageTemplateModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const MessageTemplate = ({setIsMessageTemplateModalOpen}: MessageTemplateProps) => {  
  // const defaultString = "Hello GUEST-FIRST-NAME, I would like to remind you that you will stay at TT house AirBnB for " +
  //                         "booking_duration  night(s), starting tomorrow. " + 
  //                         "Your room is ROOM-NAME (ROOM-CODE). " +
  //                         "During the construction, please use the garage door to enter the house. " +
  //                         "The garage door opener code is 1268Enter. " + 
  //                         "Please note that the last character is Enter. " +
  //                         "Please enter the code slowly and firmly to the key pad. " +
  //                         "Many thanks for staying at TT House. " +
  //                         "I wish you a pleasant stay!";
  
  const [reminderStr, setReminderStr] = useState<string>("")

  useEffect(() => {
    getSetting().then((response) => {
      
      
      const defaultString = "Hello GUEST-FIRST-NAME, I would like to remind you that you will stay at TT house AirBnB for " +
                          "booking_duration  night(s), starting tomorrow. " + 
                          "Your room is ROOM-NAME (ROOM-CODE). " +
                          "During the construction, please use the garage door to enter the house. " +
                          "The garage door opener code is 1268Enter. " + 
                          "Please note that the last character is Enter. " +
                          "Please enter the code slowly and firmly to the key pad. " +
                          "Many thanks for staying at TT House. " +
                          "I wish you a pleasant stay!";
      
      setReminderStr(response.reminderTemplate ?? defaultString)

    })
  }, [reminderStr])

  //const myCookieKey = "TiMag.reminderTemplate"


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    
    const formData = new FormData(event.currentTarget)
    const myMsg = formData.get("reminderTemplate") ?? ""
    
    //localStorage.setItem(myCookieKey, myMsg as string)
    
    await postSetting(myMsg as string)

    setIsMessageTemplateModalOpen(false)

  } // handleSubmit(){}
  
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="relative bg-white rounded-lg p-6 w-[400px] shadow-lg">
        <button
          className="absolute top-4 right-4 hover:text-black text-gray-700 font-bold text-[1.5rem]"
          onClick={() => setIsMessageTemplateModalOpen(false)}
        >
          &times;
        </button>
        <form onSubmit={handleSubmit}>
          <h2><center>Message Template</center></h2>
          <h1>Reminder message: </h1>
          <textarea name="reminderTemplate"  defaultValue={reminderStr}  className="border border-black p-2" rows={10} cols={35}/>        
          <center><input type="submit"  className="border border-black p-2 rounded-lg bg-black text-white" value="Update"></input></center>
        </form>         
      </div>
    </div>
  );
};

export default MessageTemplate;
