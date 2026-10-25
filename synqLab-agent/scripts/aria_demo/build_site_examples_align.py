import numpy as np

def align(a, b):
    """Global alignment (match 1, mismatch -1, gap -2); returns the two aligned strings."""
    n, m = len(a), len(b); S = np.zeros((n + 1, m + 1), int)
    S[:, 0] = -2 * np.arange(n + 1); S[0, :] = -2 * np.arange(m + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            S[i, j] = max(S[i-1, j-1] + (1 if a[i-1] == b[j-1] else -1), S[i-1, j] - 2, S[i, j-1] - 2)
    i, j, A, B = n, m, [], []
    while i > 0 or j > 0:
        if i > 0 and j > 0 and S[i, j] == S[i-1, j-1] + (1 if a[i-1] == b[j-1] else -1): A.append(a[i-1]); B.append(b[j-1]); i -= 1; j -= 1
        elif i > 0 and S[i, j] == S[i-1, j] - 2: A.append(a[i-1]); B.append("-"); i -= 1
        else: A.append("-"); B.append(b[j-1]); j -= 1
    return "".join(reversed(A)), "".join(reversed(B))
