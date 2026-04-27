export const AIRBNB_SYNC_HOST_ID = "681410b9d51d1dd6c713e947";
export const MAIN_HOST_ID = "677203811c91b1e24326db49";

export const redirectHost = (hostId: string): string =>
  hostId === AIRBNB_SYNC_HOST_ID ? MAIN_HOST_ID : hostId;