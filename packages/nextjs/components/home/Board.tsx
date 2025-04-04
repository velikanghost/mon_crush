import { CANDY_IMAGES, CANDY_NAMES } from "~~/utils/helpers";

interface BoardProps {
  gameBoard: number[][];
  selectedCandy: { x: number; y: number } | null;
  matches: { x: number; y: number }[];
  handleCandyClick: (x: number, y: number) => void;
}

const Board = ({ gameBoard, selectedCandy, matches, handleCandyClick }: BoardProps) => {
  return (
    <div className="relative">
      <div className="grid grid-cols-8 gap-1 md:gap-[6px] p-2 md:p-3 bg-gray-800 rounded-lg">
        {gameBoard.map((row, y) =>
          row.map((candy, x) => (
            <div
              key={`${x}-${y}`}
              className={`aspect-square rounded-sm md:rounded-md flex items-center justify-center cursor-pointer transition-all transform
                                  ${selectedCandy && selectedCandy.x === x && selectedCandy.y === y ? "ring-4 ring-purple-300 scale-110" : ""}
                                  ${matches.some(m => m.x === x && m.y === y) ? "animate-pulse bg-purple-400" : ""}`}
              style={{
                backgroundColor: candy === 0 ? "transparent" : "#F4E7EA",
                opacity: candy === 0 ? 0.2 : 1,
              }}
              onClick={() => handleCandyClick(x, y)}
            >
              {candy !== 0 && (
                <div className="flex items-center justify-center w-full h-full">
                  <img
                    src={CANDY_IMAGES[candy as keyof typeof CANDY_IMAGES]}
                    alt={CANDY_NAMES[candy as keyof typeof CANDY_NAMES]}
                    className="object-contain w-full h-full p-[6px] md:p-2"
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
