import React, { useRef, useState } from 'react'
import { DragDropProvider, DragOverlay } from '@dnd-kit/react'
import { useSortable, isSortable } from '@dnd-kit/react/sortable'

function ImageTile({ image, index, disabled, busy, dragging, renderActions }) {
  const { ref, handleRef, isDragSource } = useSortable({ id: image.id, index, disabled })
  return (
    <div ref={ref} className={`admin-gallery-item ${busy ? 'admin-gallery-item--busy' : ''} ${isDragSource ? 'admin-gallery-placeholder' : ''}`}>
      <button ref={handleRef} className="admin-gallery-drag" type="button" disabled={disabled} aria-label={`Drag image ${index + 1}`} title="Drag to reorder. With a keyboard, press Space, use arrow keys, then press Space to drop. Escape cancels.">
        <img className="admin-gallery-thumb" src={image.path} alt="" draggable={false} />
      </button>
      <span className="admin-gallery-primary-label">{index === 0 ? 'Primary' : '\u00a0'}</span>
      {renderActions(image, busy || dragging)}
    </div>
  )
}

// Keep the stored order intact while the sortable plugin previews placement.
// Only a completed drop calls the existing gallery persistence handler.
export default function ImageGallery({ images, busy, onReorder, renderActions, children }) {
  const grid = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [message, setMessage] = useState('')
  return (
    <DragDropProvider
      onDragStart={() => setDragging(true)}
      onDragEnd={event => {
        setDragging(false)
        const { source, position, activatorEvent } = event.operation
        const bounds = grid.current?.getBoundingClientRect()
        const point = position.current
        const keyboard = activatorEvent?.type === 'keydown'
        const outside = !keyboard && bounds && (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom)
        if (event.canceled || outside || !isSortable(source)) {
          // Outside drops are not library cancellations: discard its temporary DOM order.
          if (outside) setResetKey(key => key + 1)
          setMessage('Move cancelled. Original image order restored.')
          return
        }
        const from = source.initialIndex, to = source.index
        if (from !== to) {
          onReorder(from, to)
          setMessage(`Image moved to position ${to + 1}.`)
        }
      }}
    >
      <div key={resetKey} ref={grid} className="admin-gallery-grid" aria-label="Product images">
        {images.map((image, index) => <ImageTile key={image.id} image={image} index={index} disabled={busy || images.length < 2} busy={busy} dragging={dragging} renderActions={renderActions} />)}
        {children}
      </div>
      <DragOverlay className="admin-gallery-overlay" dropAnimation={null}>
        {source => <img className="admin-gallery-thumb" src={images.find(image => image.id === source.id)?.path} alt="" />}
      </DragOverlay>
      <span className="admin-gallery-announcement" role="status">{message}</span>
    </DragDropProvider>
  )
}
