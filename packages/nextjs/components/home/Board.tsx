import { useAccount } from "wagmi";
import { handleCandyClick } from "~~/services/store/gameLogic";
import { useGameStore } from "~~/services/store/gameStore";
import { CANDY_IMAGES, CANDY_NAMES } from "~~/utils/helpers";

// For backward compatibility, we accept these as props but prefer the Zustand store
interface BoardProps {
  gameBoard?: number[][];
  selectedCandy?: { x: number; y: number } | null;
  matches?: { x: number; y: number }[];
  handleCandyClick?: (x: number, y: number) => void;
}

const Board = ({
  gameBoard: propsGameBoard,
  selectedCandy: propsSelectedCandy,
  matches: propsMatches,
  handleCandyClick: propsHandleCandyClick,
}: BoardProps) => {
  const { address } = useAccount();
  const { gameBoard: storeGameBoard, selectedCandy: storeSelectedCandy, matches: storeMatches } = useGameStore();

  // Use store values with fallback to props for backward compatibility
  const gameBoard = storeGameBoard ?? propsGameBoard ?? [];
  const selectedCandy = storeSelectedCandy ?? propsSelectedCandy ?? null;
  const matches = storeMatches ?? propsMatches ?? [];

  // Handle candy click with address from useAccount
  const onCandyClick = async (x: number, y: number) => {
    if (propsHandleCandyClick) {
      propsHandleCandyClick(x, y);
    } else {
      await handleCandyClick(x, y);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="grid grid-cols-8 gap-[2px] sm:gap-1 p-2 bg-gray-800 rounded-lg">
        {gameBoard.map((row, y) =>
          row.map((candy, x) => (
            <div
              key={`${x}-${y}`}
              className={`aspect-square rounded-sm flex items-center justify-center cursor-pointer transition-all transform
                        ${selectedCandy && selectedCandy.x === x && selectedCandy.y === y ? "ring-2 sm:ring-4 ring-purple-300 scale-105 sm:scale-110" : ""}
                        ${matches.some(m => m.x === x && m.y === y) ? "animate-pulse bg-purple-400" : ""}`}
              style={{
                backgroundColor: candy === 0 ? "transparent" : "#F4E7EA",
                opacity: candy === 0 ? 0.2 : 1,
              }}
              onClick={() => onCandyClick(x, y)}
            >
              {candy !== 0 && (
                <div className="flex items-center justify-center w-full h-full">
                  <img
                    src={CANDY_IMAGES[candy as keyof typeof CANDY_IMAGES]}
                    alt={CANDY_NAMES[candy as keyof typeof CANDY_NAMES]}
                    className="object-contain w-full h-full p-[3px] sm:p-[6px]"
                  />
                </div>
              )}
            </div>
          )),
        )}
      </div>
    </div>
  );
};

export default Board;
