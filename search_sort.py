# Copyright (c) 2026 MyCompany LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
This module provides implementations of basic sorting and searching algorithms:
- Bubble Sort
- Binary Search
"""

from typing import List, Any


def bubble_sort(arr: List[Any]) -> List[Any]:
    """
    Sorts a list in-place using the Bubble Sort algorithm.

    Parameters:
        arr (List[Any]): The list of elements to be sorted.

    Returns:
        List[Any]: The sorted list.
    """
    n = len(arr)
    # Outer loop to traverse through all list elements
    for i in range(n):
        swapped = False
        # Inner loop to perform adjacent comparisons and swaps
        # The last i elements are already in place, so we decrease the range
        for j in range(0, n - i - 1):
            # Swap if the element found is greater than the next element
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        # If no elements were swapped in the inner loop, the list is sorted
        if not swapped:
            break
    return arr


def binary_search(arr: List[Any], target: Any) -> int:
    """
    Searches for a target element in a sorted list using Binary Search.

    Parameters:
        arr (List[Any]): A sorted list of elements.
        target (Any): The element to search for.

    Returns:
        int: The 0-based index of the target if found; otherwise, -1.
    """
    low = 0
    high = len(arr) - 1

    # Keep searching while search space is valid
    while low <= high:
        # Calculate the middle index
        mid = (low + high) // 2
        mid_val = arr[mid]

        # Check if the target is found at the middle index
        if mid_val == target:
            return mid
        # If the target is larger, search in the right sublist
        elif mid_val < target:
            low = mid + 1
        # If the target is smaller, search in the left sublist
        else:
            high = mid - 1

    # Return -1 if the target is not present in the list
    return -1
