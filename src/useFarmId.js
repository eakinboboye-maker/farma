import { useEffect, useState } from "react";

export function useFarmId() {
  const [farmId, setFarmId] = useState(null);

  useEffect(() => {
    const id = localStorage.getItem("selectedFarmId");
    setFarmId(id);
  }, []);

  return farmId;
}

