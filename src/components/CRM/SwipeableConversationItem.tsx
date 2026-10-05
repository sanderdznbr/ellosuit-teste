import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface SwipeableConversationItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  onSelect: () => void;
  disabled?: boolean;
}

const SwipeableConversationItem: React.FC<SwipeableConversationItemProps> = ({
  children,
  onDelete,
  onSelect,
  disabled = false
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const x = useMotionValue(0);
  
  // Transform x position to background opacity and button visibility
  const deleteOpacity = useTransform(x, [-150, -50, 0], [1, 0.5, 0]);
  const deleteScale = useTransform(x, [-150, -50, 0], [1, 0.8, 0.5]);
  
  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = -120;
    
    if (info.offset.x < threshold) {
      // Auto-delete when swiped far enough
      setIsDeleting(true);
      setTimeout(() => {
        onDelete();
      }, 200);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    setTimeout(() => {
      onDelete();
    }, 200);
  };

  if (disabled) {
    return (
      <div onClick={onSelect}>
        {children}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete Background */}
      <motion.div 
        className="absolute inset-y-0 right-0 flex items-center justify-end bg-gradient-to-l from-red-500 to-red-600 px-4 rounded-r-2xl"
        style={{ opacity: deleteOpacity }}
      >
        <motion.button
          onClick={handleDeleteClick}
          className="flex flex-col items-center gap-1 text-white p-3"
          style={{ scale: deleteScale }}
          whileTap={{ scale: 0.9 }}
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-xs font-medium">Excluir</span>
        </motion.button>
      </motion.div>
      
      {/* Swipeable Content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        onClick={onSelect}
        animate={isDeleting ? { x: -500, opacity: 0 } : {}}
        transition={{ duration: 0.2 }}
        className="relative bg-card cursor-pointer touch-pan-y rounded-2xl"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableConversationItem;
