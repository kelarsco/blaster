import React from 'react';
import { ChevronLeft, ChevronRight } from 'react-feather';

export function StoresPagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('…');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  return (
    <nav className="stores-pagination" aria-label="Stores pagination">
      <button type="button" className="stores-page-nav" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        <ChevronLeft className="w-4 h-4" strokeWidth={2} /> Previous
      </button>
      {pages.map((page, index) =>
        typeof page === 'number' ? (
          <button key={page} type="button" className={`stores-page-btn ${currentPage === page ? 'is-active' : ''}`} onClick={() => onPageChange(page)}>
            {page}
          </button>
        ) : (
          <span key={`e-${index}`} className="px-1 text-blaster-muted text-sm">{page}</span>
        )
      )}
      <button type="button" className="stores-page-nav" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
        Next <ChevronRight className="w-4 h-4" strokeWidth={2} />
      </button>
    </nav>
  );
}
