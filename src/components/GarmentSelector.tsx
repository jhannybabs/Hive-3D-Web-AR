// import { useEffect, useState } from "react";
// import { setGarmentModels } from "../lib/utils/garmentSwitcher.util";
// import { TUNNEL_URL } from "../lib/utils/fetch.util";

// type Garment = {
//   id: string;
//   designName: string;
//   modelPath: string;
// };

// export default function GarmentSelector() {
//   const [garments, setGarments] = useState<Garment[]>([]);

//   useEffect(() => {
//     fetch(`${TUNNEL_URL}/designs/get-designs`)
//       .then((res) => res.json())
//       .then((data: Garment[]) => {
//         setGarmentModels(data);
//         setGarments(data);
//         console.log("Fetched garments:", data);
//       })
//       .catch((err) => console.error("Failed to fetch garments:", err));
//   }, []);

//   return (
//     <select>
//       {garments.map((g) => (
//         <option key={g.id} value={g.id}>
//           {g.designName}
//         </option>
//       ))}
//     </select>
//   );
// }
