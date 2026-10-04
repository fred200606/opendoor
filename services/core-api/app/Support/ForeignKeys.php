<?php

namespace App\Support;

use Closure;
use Illuminate\Database\QueryException;

class ForeignKeys
{
    /**
     * Runs a delete and reports whether a foreign key (restrictOnDelete) blocked it.
     * Tables that reference master data must use restrictOnDelete so "in use" is
     * enforced by the database, not by a hand-maintained list of tables.
     *
     * @param  Closure(): mixed  $delete
     * @return bool true when deleted, false when the row is still referenced
     */
    public static function deleteUnlessReferenced(Closure $delete): bool
    {
        try {
            $delete();

            return true;
        } catch (QueryException $e) {
            // SQLSTATE 23000 = integrity constraint violation (MySQL 1451, SQLite 19).
            if ((string) $e->getCode() === '23000') {
                return false;
            }

            throw $e;
        }
    }
}
