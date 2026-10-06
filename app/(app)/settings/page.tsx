import { SettingsClient } from "./SettingsClient";
import { SignOut } from "./SignOut";

export default function Settings() {
  return (
    <>
      <h1 className="h1">Settings</h1>
      <SettingsClient />
      <SignOut />
    </>
  );
}
